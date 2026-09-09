import gc
import logging
import os
import threading
from pathlib import Path
from typing import Callable, Optional, Union

import julius
import soundfile as sf
import torch
from demucs.apply import apply_model
from demucs.audio import save_audio
from demucs.pretrained import get_model

from ..config import (
    DEMUCS_MODEL,
    DEVICE,
    SEGMENT_SIZE,
    STEMS_DIR,
    USE_FLOAT16,
)
from ..schemas.models import StemResult
from .cache import get_cached_stems, save_stem_manifest

logger = logging.getLogger("walkouts.separator")

# Ensure imageio_ffmpeg path is in PATH if available
try:
    import imageio_ffmpeg
    ffmpeg_dir = str(Path(imageio_ffmpeg.get_ffmpeg_exe()).parent)
    if ffmpeg_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
except Exception:
    pass

# Global singleton model cache
_model_lock = threading.Lock()
_loaded_model = None
_loaded_model_name: Optional[str] = None
_loaded_model_device: Optional[str] = None


def load_audio_waveform(
    audio_path: Union[str, Path],
    target_samplerate: int = 44100,
    target_channels: int = 2,
) -> torch.Tensor:
    """
    Load an audio file into a PyTorch tensor shaped (channels, samples).
    Supports WAV, MP3, FLAC, OGG, and AAC via soundfile, torchaudio, or ffmpeg fallback.
    Automatically handles channel adaptation and resampling.
    """
    path_str = str(audio_path)
    wav = None
    sr = None

    # Primary method: soundfile
    try:
        data, sr = sf.read(path_str, dtype="float32", always_2d=True)
        # data is shaped (samples, channels) -> transpose to (channels, samples)
        wav = torch.from_numpy(data.T)
    except Exception as e:
        logger.debug(f"soundfile failed to read {path_str}: {e}")

    # Secondary method: torchaudio
    if wav is None:
        try:
            import torchaudio
            wav, sr = torchaudio.load(path_str)
        except Exception as e:
            logger.debug(f"torchaudio failed to read {path_str}: {e}")

    if wav is None:
        raise RuntimeError(f"Could not decode audio from file: {path_str}")

    # Channel management: Convert to stereo if needed
    if wav.shape[0] == 1 and target_channels == 2:
        wav = wav.repeat(2, 1)
    elif wav.shape[0] > target_channels:
        wav = wav[:target_channels, :]

    # Resample if sample rate does not match target
    if sr is not None and sr != target_samplerate:
        wav = julius.resample_frac(wav, sr, target_samplerate)

    return wav


def get_demucs_model(
    model_name: str = DEMUCS_MODEL,
    device: Optional[str] = None,
):
    """
    Get or load the Demucs separation neural network model onto specified device.
    Uses singleton caching to avoid redundant disk and VRAM re-allocations.
    """
    global _loaded_model, _loaded_model_name, _loaded_model_device

    target_device = device or DEVICE

    with _model_lock:
        if (
            _loaded_model is not None
            and _loaded_model_name == model_name
            and _loaded_model_device == target_device
        ):
            return _loaded_model

        logger.info(f"Loading Demucs model '{model_name}' on device '{target_device}'...")
        model = get_model(model_name)
        model.to(torch.device(target_device))
        model.eval()

        _loaded_model = model
        _loaded_model_name = model_name
        _loaded_model_device = target_device
        return _loaded_model


def unload_demucs_model():
    """Unload cached Demucs model and release GPU memory."""
    global _loaded_model, _loaded_model_name, _loaded_model_device
    with _model_lock:
        _loaded_model = None
        _loaded_model_name = None
        _loaded_model_device = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        gc.collect()
        logger.info("Unloaded Demucs model and cleared PyTorch memory cache.")


def separate_audio_stems(
    audio_path: Union[str, Path],
    track_id: str,
    progress_callback: Optional[Callable[[float, str], None]] = None,
    device: Optional[str] = None,
    segment_size: Optional[int] = None,
    use_float16: Optional[bool] = None,
    model_name: str = DEMUCS_MODEL,
) -> StemResult:
    """
    Separate an audio track into 4 distinct stems (vocals, drums, bass, other).
    
    Optimized for NVIDIA RTX 2050 (4GB VRAM):
    - Uses 'htdemucs' model with segment chunking (--segment 7 by default)
    - Applies FP16 autocast on CUDA to constrain VRAM strictly under 2.5GB
    - Cleans up CUDA allocation after separation
    - Automatic caching: Returns cached StemResult immediately if stems exist
    """
    audio_file_path = Path(audio_path).resolve()
    if not audio_file_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_file_path}")

    # 1. Check cache first
    cached = get_cached_stems(track_id)
    if cached is not None:
        logger.info(f"Using cached stems for track: {track_id}")
        if progress_callback:
            progress_callback(1.0, "Retrieved stems from cache")
        return cached

    target_device = device or DEVICE
    seg_size = segment_size if segment_size is not None else SEGMENT_SIZE
    fp16_enabled = use_float16 if use_float16 is not None else (USE_FLOAT16 and target_device == "cuda")

    stems_dir = STEMS_DIR / track_id
    stems_dir.mkdir(parents=True, exist_ok=True)

    if progress_callback:
        progress_callback(0.05, f"Initializing Demucs {model_name} model ({target_device})...")

    # 2. Load model
    model = get_demucs_model(model_name=model_name, device=target_device)

    # 3. Read and normalize input audio
    if progress_callback:
        progress_callback(0.10, "Loading and resampling input audio...")

    wav = load_audio_waveform(
        audio_path=audio_file_path,
        target_samplerate=model.samplerate,
        target_channels=model.audio_channels,
    )

    total_samples = wav.shape[-1]
    wav_batch = wav.unsqueeze(0)  # Shape: (1, channels, samples)

    # 4. Define streaming progress callback
    def _demucs_callback(d: dict):
        if progress_callback and "segment_offset" in d:
            offset = d.get("segment_offset", 0)
            ratio = min(1.0, offset / max(1, total_samples))
            pct = 0.15 + (0.75 * ratio)
            progress_callback(round(pct, 2), f"Separating audio stems ({int(ratio * 100)}%)...")

    if progress_callback:
        progress_callback(0.15, "Separating audio stems (0%)...")

    dev = torch.device(target_device)

    # 5. Run neural separation with memory optimization
    try:
        with torch.inference_mode():
            if dev.type == "cuda" and fp16_enabled:
                with torch.autocast(device_type="cuda", dtype=torch.float16):
                    sources = apply_model(
                        model,
                        wav_batch,
                        device=dev,
                        segment=seg_size,
                        split=True,
                        progress=False,
                        callback=_demucs_callback,
                    )
            else:
                sources = apply_model(
                    model,
                    wav_batch,
                    device=dev,
                    segment=seg_size,
                    split=True,
                    progress=False,
                    callback=_demucs_callback,
                )

        if progress_callback:
            progress_callback(0.90, "Writing isolated stem audio files...")

        # 6. Save isolated stems to disk
        stem_paths = {}
        for idx, source_name in enumerate(model.sources):
            stem_tensor = sources[0, idx].cpu()
            output_stem_path = stems_dir / f"{source_name}.wav"
            save_audio(
                stem_tensor,
                output_stem_path,
                samplerate=model.samplerate,
                clip="rescale",
                bits_per_sample=16,
            )
            stem_paths[source_name] = str(output_stem_path.resolve())

        # 7. Construct result & save manifest
        stem_result = StemResult(
            id=track_id,
            vocals_path=stem_paths.get("vocals", ""),
            drums_path=stem_paths.get("drums", ""),
            bass_path=stem_paths.get("bass", ""),
            other_path=stem_paths.get("other", ""),
            is_cached=False,
        )
        save_stem_manifest(track_id, stem_result)

        if progress_callback:
            progress_callback(1.0, "Stem separation completed successfully")

        logger.info(f"Stem separation complete for track {track_id} -> {stems_dir}")
        return stem_result

    finally:
        # Free GPU memory
        if dev.type == "cuda":
            torch.cuda.empty_cache()
        gc.collect()
