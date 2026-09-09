import hashlib
import logging
import os
from pathlib import Path
import subprocess
from typing import Callable, Dict, Optional

import soundfile as sf
import yt_dlp

from backend.app.config import DOWNLOADS_DIR
from backend.app.schemas.models import MediaInfo

logger = logging.getLogger("walkouts.downloader")

# Ensure imageio_ffmpeg path is registered in environment if available
try:
    import imageio_ffmpeg
    FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()
    ffmpeg_dir = str(Path(FFMPEG_EXE).parent)
    if ffmpeg_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
except Exception as e:
    logger.warning(f"Could not load imageio_ffmpeg: {e}")
    FFMPEG_EXE = "ffmpeg"


def get_media_hash(content: bytes | str) -> str:
    """Generate MD5 hash for content deduplication."""
    if isinstance(content, str):
        data = content.strip().encode("utf-8")
    else:
        data = content
    return hashlib.md5(data).hexdigest()


def extract_youtube_info(url: str) -> dict:
    """Fast metadata extraction for YouTube URLs without downloading media."""
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
        "noplaylist": True,
        "skip_download": True,
    }
    if FFMPEG_EXE and os.path.exists(FFMPEG_EXE):
        ydl_opts["ffmpeg_location"] = FFMPEG_EXE

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        if not info:
            raise ValueError(f"Could not extract info from URL: {url}")
        
        # Handle playlist / multi-entry fallback
        if "entries" in info and info["entries"]:
            info = info["entries"][0]

        video_id = info.get("id") or get_media_hash(url)
        title = info.get("title") or f"YouTube Video {video_id}"
        duration = float(info.get("duration") or 0.0)
        thumbnail = info.get("thumbnail")

        return {
            "id": video_id,
            "title": title,
            "duration": duration,
            "thumbnail": thumbnail,
            "url": url,
            "channel": info.get("uploader") or info.get("channel"),
        }


def _convert_audio_to_wav(input_path: Path, output_wav_path: Path, sample_rate: int = 44100) -> bool:
    """Converts any input audio/video file to 44.1kHz stereo 16-bit WAV using ffmpeg."""
    try:
        cmd = [
            FFMPEG_EXE,
            "-y",
            "-i", str(input_path),
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", str(sample_rate),
            "-ac", "2",
            str(output_wav_path)
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return output_wav_path.exists() and output_wav_path.stat().st_size > 0
    except Exception as exc:
        logger.error(f"FFmpeg audio conversion failed for {input_path}: {exc}")
        return False


def _extract_muted_video(input_path: Path, output_mp4_path: Path) -> bool:
    """Remuxes or re-encodes video file to muted MP4 for synchronized playback."""
    try:
        cmd = [
            FFMPEG_EXE,
            "-y",
            "-i", str(input_path),
            "-an",
            "-c:v", "copy",
            str(output_mp4_path)
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode != 0 or not output_mp4_path.exists() or output_mp4_path.stat().st_size == 0:
            # Fallback re-encode if stream copy fails
            cmd_fallback = [
                FFMPEG_EXE,
                "-y",
                "-i", str(input_path),
                "-an",
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-pix_fmt", "yuv420p",
                str(output_mp4_path)
            ]
            subprocess.run(cmd_fallback, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return output_mp4_path.exists() and output_mp4_path.stat().st_size > 0
    except Exception as exc:
        logger.error(f"FFmpeg muted video extraction failed for {input_path}: {exc}")
        return False


def _get_audio_duration(audio_path: Path) -> float:
    """Gets audio duration in seconds using soundfile or fallback."""
    try:
        info = sf.info(str(audio_path))
        return float(info.duration)
    except Exception:
        return 0.0


def download_from_youtube(url: str, progress_hook: Optional[Callable[[Dict], None]] = None) -> MediaInfo:
    """
    Downloads best audio (converted to 44.1kHz stereo WAV) and muted MP4 video (if available)
    from a YouTube URL into DOWNLOADS_DIR/<track_id>/.
    """
    info = extract_youtube_info(url)
    track_id = info["id"]
    title = info["title"]
    nominal_duration = info["duration"]

    track_dir = DOWNLOADS_DIR / track_id
    track_dir.mkdir(parents=True, exist_ok=True)

    target_audio = track_dir / "audio.wav"
    target_video = track_dir / "video.mp4"

    # If audio already exists, return cached MediaInfo
    if target_audio.exists() and target_audio.stat().st_size > 0:
        actual_duration = _get_audio_duration(target_audio) or nominal_duration
        video_path = str(target_video) if target_video.exists() else None
        return MediaInfo(
            id=track_id,
            title=title,
            audio_path=str(target_audio),
            video_path=video_path,
            duration=actual_duration,
            source_type="youtube",
        )

    # 1. Download best audio
    raw_audio_template = str(track_dir / "raw_audio.%(ext)s")
    ydl_audio_opts = {
        "format": "bestaudio/best",
        "outtmpl": raw_audio_template,
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
    }
    if FFMPEG_EXE and os.path.exists(FFMPEG_EXE):
        ydl_audio_opts["ffmpeg_location"] = FFMPEG_EXE
    if progress_hook:
        ydl_audio_opts["progress_hooks"] = [progress_hook]

    with yt_dlp.YoutubeDL(ydl_audio_opts) as ydl:
        ydl.download([url])

    # Locate the downloaded raw audio file
    raw_audio_files = list(track_dir.glob("raw_audio.*"))
    if not raw_audio_files:
        raise RuntimeError(f"Failed to download audio for {url}")
    
    downloaded_raw_audio = raw_audio_files[0]
    
    # Convert downloaded audio to normalized 44.1kHz stereo WAV
    conversion_success = _convert_audio_to_wav(downloaded_raw_audio, target_audio)
    if not conversion_success or not target_audio.exists():
        # Fallback to using raw audio file if ffmpeg failed
        target_audio = downloaded_raw_audio
    else:
        # Cleanup raw audio file if converted successfully
        try:
            downloaded_raw_audio.unlink(missing_ok=True)
        except Exception:
            pass

    # 2. Attempt to download best muted video (optional, non-blocking failure)
    video_path: Optional[str] = None
    if not target_video.exists():
        raw_video_template = str(track_dir / "raw_video.%(ext)s")
        ydl_video_opts = {
            "format": "bestvideo[ext=mp4]/best[ext=mp4]/bestvideo/best",
            "outtmpl": raw_video_template,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "max_filesize": 250 * 1024 * 1024,  # 250MB limit
        }
        if FFMPEG_EXE and os.path.exists(FFMPEG_EXE):
            ydl_video_opts["ffmpeg_location"] = FFMPEG_EXE

        try:
            with yt_dlp.YoutubeDL(ydl_video_opts) as ydl:
                ydl.download([url])
            raw_video_files = list(track_dir.glob("raw_video.*"))
            if raw_video_files:
                downloaded_raw_vid = raw_video_files[0]
                if _extract_muted_video(downloaded_raw_vid, target_video):
                    video_path = str(target_video)
                    downloaded_raw_vid.unlink(missing_ok=True)
                else:
                    video_path = str(downloaded_raw_vid)
        except Exception as vid_err:
            logger.warning(f"Video download skipped/failed for {url}: {vid_err}")
            video_path = None
    else:
        video_path = str(target_video)

    duration = _get_audio_duration(target_audio) or nominal_duration

    return MediaInfo(
        id=track_id,
        title=title,
        audio_path=str(target_audio),
        video_path=video_path,
        duration=duration,
        source_type="youtube",
    )


def save_uploaded_media(filename: str, file_bytes: bytes) -> MediaInfo:
    """
    Saves uploaded audio/video files to DOWNLOADS_DIR/<track_id>/ and
    converts/normalizes the audio to a standard 44.1kHz stereo WAV file.
    """
    track_id = get_media_hash(file_bytes)
    track_dir = DOWNLOADS_DIR / track_id
    track_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(filename).suffix.lower()
    title = Path(filename).stem or "Uploaded Track"

    video_extensions = {".mp4", ".webm", ".mkv", ".mov", ".avi", ".m4v"}
    audio_extensions = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".wma"}

    target_audio = track_dir / "audio.wav"
    target_video = track_dir / "video.mp4"
    video_path: Optional[str] = None

    if ext in video_extensions:
        # Save raw video
        raw_video_path = track_dir / f"raw_video{ext}"
        raw_video_path.write_bytes(file_bytes)

        # Extract audio stream to 44.1kHz stereo WAV
        conv_ok = _convert_audio_to_wav(raw_video_path, target_audio)
        if not conv_ok or not target_audio.exists():
            # If audio extraction fails, check if soundfile or torchaudio can read it
            target_audio = raw_video_path

        # Create muted video track
        if _extract_muted_video(raw_video_path, target_video):
            video_path = str(target_video)
            raw_video_path.unlink(missing_ok=True)
        else:
            video_path = str(raw_video_path)

    else:
        # Save audio file
        raw_audio_path = track_dir / f"raw_audio{ext}"
        raw_audio_path.write_bytes(file_bytes)

        if ext == ".wav":
            # If already wav, test if it's readable, otherwise re-encode
            try:
                sf_info = sf.info(str(raw_audio_path))
                if sf_info.samplerate == 44100 and sf_info.channels == 2:
                    if raw_audio_path != target_audio:
                        raw_audio_path.replace(target_audio)
                else:
                    _convert_audio_to_wav(raw_audio_path, target_audio)
                    raw_audio_path.unlink(missing_ok=True)
            except Exception:
                _convert_audio_to_wav(raw_audio_path, target_audio)
                raw_audio_path.unlink(missing_ok=True)
        else:
            # Convert mp3/flac/ogg/m4a to 44.1kHz stereo WAV
            conv_ok = _convert_audio_to_wav(raw_audio_path, target_audio)
            if conv_ok and target_audio.exists():
                raw_audio_path.unlink(missing_ok=True)
            else:
                target_audio = raw_audio_path

    duration = _get_audio_duration(target_audio)

    return MediaInfo(
        id=track_id,
        title=title,
        audio_path=str(target_audio),
        video_path=video_path,
        duration=duration,
        source_type="upload",
    )
