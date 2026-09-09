import io
from pathlib import Path
from unittest.mock import MagicMock, patch
import numpy as np
import pytest
import soundfile as sf

from backend.app.config import DOWNLOADS_DIR
from backend.app.schemas.models import MediaInfo, ProcessRequest, ProcessResponse, StemResult
from backend.app.services.downloader import (
    download_from_youtube,
    extract_youtube_info,
    get_media_hash,
    save_uploaded_media,
)


def create_sample_wav_bytes(duration_sec: float = 1.0, sample_rate: int = 44100, channels: int = 2) -> bytes:
    """Helper to generate in-memory WAV audio bytes."""
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), endpoint=False)
    # Sine wave at 440 Hz
    if channels == 2:
        data = np.column_stack([np.sin(2 * np.pi * 440 * t), np.sin(2 * np.pi * 880 * t)]).astype(np.float32)
    else:
        data = np.sin(2 * np.pi * 440 * t).astype(np.float32)

    buf = io.BytesIO()
    sf.write(buf, data, sample_rate, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def test_schema_models():
    """Verify schema models instantiate with correct validation."""
    media = MediaInfo(
        id="test1234",
        title="Test Song",
        audio_path="C:/path/audio.wav",
        video_path=None,
        duration=120.5,
        source_type="youtube",
    )
    assert media.id == "test1234"
    assert media.title == "Test Song"
    assert media.duration == 120.5
    assert media.source_type == "youtube"

    req = ProcessRequest(url="https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert req.url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

    resp = ProcessResponse(task_id="task_1", status="queued", media_info=media)
    assert resp.task_id == "task_1"
    assert resp.status == "queued"
    assert resp.media_info.id == "test1234"

    stem = StemResult(
        id="test1234",
        vocals_path="C:/path/vocals.wav",
        drums_path="C:/path/drums.wav",
        bass_path="C:/path/bass.wav",
        other_path="C:/path/other.wav",
        is_cached=True,
    )
    assert stem.id == "test1234"
    assert stem.is_cached is True


def test_get_media_hash():
    """Verify hash generation for strings and bytes."""
    text_input = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    hash1 = get_media_hash(text_input)
    hash2 = get_media_hash(text_input.encode("utf-8"))
    assert isinstance(hash1, str)
    assert len(hash1) == 32
    assert hash1 == hash2

    diff_hash = get_media_hash("different_content")
    assert diff_hash != hash1


@patch("backend.app.services.downloader.yt_dlp.YoutubeDL")
def test_extract_youtube_info(mock_ydl_cls):
    """Verify YouTube info extraction metadata formatting."""
    mock_instance = MagicMock()
    mock_instance.extract_info.return_value = {
        "id": "dQw4w9WgXcQ",
        "title": "Rick Astley - Never Gonna Give You Up",
        "duration": 213.0,
        "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        "uploader": "RickAstleyVEVO",
    }
    mock_ydl_cls.return_value.__enter__.return_value = mock_instance

    info = extract_youtube_info("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

    assert info["id"] == "dQw4w9WgXcQ"
    assert info["title"] == "Rick Astley - Never Gonna Give You Up"
    assert info["duration"] == 213.0
    assert info["channel"] == "RickAstleyVEVO"
    assert "thumbnail" in info


def test_save_uploaded_audio_wav(tmp_path):
    """Verify saving uploaded WAV file normalizes audio and produces MediaInfo."""
    wav_bytes = create_sample_wav_bytes(duration_sec=1.5, sample_rate=44100, channels=2)
    filename = "my_custom_track.wav"

    media_info = save_uploaded_media(filename, wav_bytes)

    assert media_info.id == get_media_hash(wav_bytes)
    assert media_info.title == "my_custom_track"
    assert media_info.source_type == "upload"
    assert Path(media_info.audio_path).exists()
    assert abs(media_info.duration - 1.5) < 0.1

    # Verify audio file properties
    sf_info = sf.info(media_info.audio_path)
    assert sf_info.samplerate == 44100
    assert sf_info.channels == 2


def test_save_uploaded_audio_resampling(tmp_path):
    """Verify saving uploaded non-44.1kHz mono WAV converts properly."""
    wav_bytes = create_sample_wav_bytes(duration_sec=1.0, sample_rate=22050, channels=1)
    filename = "mono_track.wav"

    media_info = save_uploaded_media(filename, wav_bytes)

    assert media_info.id == get_media_hash(wav_bytes)
    assert Path(media_info.audio_path).exists()

    sf_info = sf.info(media_info.audio_path)
    assert sf_info.samplerate == 44100
    assert sf_info.channels == 2


@patch("backend.app.services.downloader.extract_youtube_info")
def test_download_from_youtube_cached(mock_extract):
    """Verify cached YouTube downloads immediately return MediaInfo without re-downloading."""
    fake_id = "cached_video_id"
    mock_extract.return_value = {
        "id": fake_id,
        "title": "Cached Song",
        "duration": 60.0,
        "thumbnail": None,
        "url": "https://youtube.com/watch?v=cached",
    }

    target_dir = DOWNLOADS_DIR / fake_id
    target_dir.mkdir(parents=True, exist_ok=True)
    audio_path = target_dir / "audio.wav"

    # Write a test audio file into the target directory
    wav_bytes = create_sample_wav_bytes(duration_sec=2.0)
    audio_path.write_bytes(wav_bytes)

    media = download_from_youtube("https://youtube.com/watch?v=cached")

    assert media.id == fake_id
    assert media.title == "Cached Song"
    assert Path(media.audio_path) == audio_path
    assert abs(media.duration - 2.0) < 0.1
    assert media.source_type == "youtube"
