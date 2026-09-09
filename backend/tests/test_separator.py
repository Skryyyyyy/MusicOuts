import math
import numpy as np
import pytest
from pathlib import Path
from unittest.mock import patch

import torch
from demucs.audio import save_audio

from app.schemas.models import StemResult
from app.services.cache import (
    get_stems_dir,
    get_cached_stems,
    save_stem_manifest,
    is_stem_cached,
    clear_stem_cache,
)
from app.services.separator import (
    get_demucs_model,
    unload_demucs_model,
    separate_audio_stems,
)


@pytest.fixture
def synthetic_audio(tmp_path: Path) -> Path:
    """
    Generate a 2-second polyphonic synthetic audio WAV file at 44.1 kHz stereo:
    - 100 Hz bass tone
    - 440 Hz vocal tone
    - Periodic transient clicks for drum simulation
    """
    samplerate = 44100
    duration = 2.0
    t = np.linspace(0, duration, int(samplerate * duration), endpoint=False)

    # Bass wave (100 Hz sine)
    bass = 0.3 * np.sin(2 * np.pi * 100 * t)

    # Vocal wave (440 Hz sine)
    vocals = 0.3 * np.sin(2 * np.pi * 440 * t)

    # Drum transient ticks (click pulse every 0.5s)
    drums = np.zeros_like(t)
    for tick_time in [0.0, 0.5, 1.0, 1.5]:
        tick_idx = int(tick_time * samplerate)
        decay_len = min(2000, len(t) - tick_idx)
        decay = np.exp(-np.linspace(0, 10, decay_len))
        noise = (np.random.rand(decay_len) * 2 - 1) * 0.4
        drums[tick_idx : tick_idx + decay_len] += noise * decay

    mix = bass + vocals + drums
    # Stereo shape: (2, samples)
    stereo_mix = np.stack([mix, mix], axis=0).astype(np.float32)

    tensor_audio = torch.from_numpy(stereo_mix)
    audio_path = tmp_path / "synthetic_mix.wav"
    save_audio(tensor_audio, audio_path, samplerate=samplerate)
    return audio_path


def test_cache_helpers(tmp_path: Path, monkeypatch):
    """Test stem cache detection, manifest serialization, and clearing."""
    monkeypatch.setattr("app.services.cache.STEMS_DIR", tmp_path)

    track_id = "test_cache_track_01"
    assert not is_stem_cached(track_id)
    assert get_cached_stems(track_id) is None

    # Create dummy stem files
    track_dir = tmp_path / track_id
    track_dir.mkdir(parents=True, exist_ok=True)
    vocals = track_dir / "vocals.wav"
    drums = track_dir / "drums.wav"
    bass = track_dir / "bass.wav"
    other = track_dir / "other.wav"

    vocals.write_bytes(b"RIFF" + b"\x00" * 100)
    drums.write_bytes(b"RIFF" + b"\x00" * 100)
    bass.write_bytes(b"RIFF" + b"\x00" * 100)
    other.write_bytes(b"RIFF" + b"\x00" * 100)

    # Without manifest, file discovery should identify all 4 stems
    stem_result = get_cached_stems(track_id)
    assert stem_result is not None
    assert stem_result.id == track_id
    assert stem_result.is_cached is True
    assert Path(stem_result.vocals_path).name == "vocals.wav"

    # Save manifest
    manifest_path = save_stem_manifest(track_id, stem_result)
    assert manifest_path.exists()
    assert is_stem_cached(track_id) is True

    # Clear cache
    assert clear_stem_cache(track_id) is True
    assert not is_stem_cached(track_id)
    assert get_cached_stems(track_id) is None


def test_separate_missing_file():
    """Verify FileNotFoundError on non-existent audio path."""
    with pytest.raises(FileNotFoundError):
        separate_audio_stems("non_existent_file.wav", "track_xyz")


def test_model_loading_and_unloading():
    """Verify model singleton acquisition and memory clearing."""
    model = get_demucs_model()
    assert model is not None
    assert hasattr(model, "sources")
    assert set(model.sources) == {"vocals", "drums", "bass", "other"}

    unload_demucs_model()


def test_demucs_separation_pipeline(synthetic_audio: Path, tmp_path: Path, monkeypatch):
    """
    End-to-end separation test on synthetic audio:
    - Runs separation pipeline on CPU/CUDA
    - Verifies all 4 isolated stem files are generated and non-empty
    - Verifies progress callback messages
    - Verifies caching mechanism returns cached StemResult on subsequent calls
    """
    stems_test_dir = tmp_path / "stems"
    stems_test_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr("app.services.cache.STEMS_DIR", stems_test_dir)
    monkeypatch.setattr("app.services.separator.STEMS_DIR", stems_test_dir)

    track_id = "synthetic_track_test_1"
    progress_records = []

    def progress_cb(pct: float, msg: str):
        progress_records.append((pct, msg))

    # 1. Initial Separation
    result = separate_audio_stems(
        audio_path=synthetic_audio,
        track_id=track_id,
        progress_callback=progress_cb,
    )

    assert result.id == track_id
    assert result.is_cached is False
    assert Path(result.vocals_path).exists() and Path(result.vocals_path).stat().st_size > 0
    assert Path(result.drums_path).exists() and Path(result.drums_path).stat().st_size > 0
    assert Path(result.bass_path).exists() and Path(result.bass_path).stat().st_size > 0
    assert Path(result.other_path).exists() and Path(result.other_path).stat().st_size > 0

    # Verify progress callbacks were made
    assert len(progress_records) >= 3
    assert progress_records[-1][0] == 1.0

    # 2. Subsequent call should hit cache without model execution
    with patch("app.services.separator.apply_model") as mock_apply:
        cached_result = separate_audio_stems(
            audio_path=synthetic_audio,
            track_id=track_id,
        )
        assert cached_result.id == track_id
        assert cached_result.is_cached is True
        mock_apply.assert_not_called()
