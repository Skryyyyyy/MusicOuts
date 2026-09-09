import asyncio
import io
import json
from pathlib import Path
import time
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from backend.app.config import DOWNLOADS_DIR, STEMS_DIR
from backend.app.main import app
from backend.app.schemas.models import MediaInfo, StemResult
from backend.app.services.cache import save_stem_manifest
from backend.app.services.task_manager import task_manager

client = TestClient(app)


def create_sample_wav_bytes(duration_sec: float = 0.5, sample_rate: int = 44100) -> bytes:
    """Helper to generate in-memory WAV audio bytes."""
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), endpoint=False)
    data = (0.5 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    stereo = np.column_stack([data, data])
    buf = io.BytesIO()
    sf.write(buf, stereo, sample_rate, format="WAV", subtype="PCM_16")
    return buf.getvalue()


@pytest.fixture(autouse=True)
def clean_task_manager():
    """Clear task manager before each test."""
    task_manager.clear()
    yield
    task_manager.clear()


def test_youtube_endpoint_validation():
    """Verify input validation on POST /api/process/youtube."""
    # Missing or empty body
    res = client.post("/api/process/youtube", json={})
    assert res.status_code == 400

    res = client.post("/api/process/youtube", json={"url": ""})
    assert res.status_code == 400

    res = client.post("/api/process/youtube", json={"url": "   "})
    assert res.status_code == 400


@patch("backend.app.api.routes_process.extract_youtube_info")
@patch("backend.app.api.routes_process.download_from_youtube")
@patch("backend.app.api.routes_process.separate_audio_stems")
def test_youtube_endpoint_success(mock_sep, mock_dl, mock_info, tmp_path):
    """Verify POST /api/process/youtube initiates task and background pipeline."""
    track_id = "mock_yt_vid_123"
    url = "https://www.youtube.com/watch?v=mock_yt_vid_123"

    mock_info.return_value = {
        "id": track_id,
        "title": "Mock Video Title",
        "duration": 120.0,
        "thumbnail": None,
    }

    dummy_audio = tmp_path / "audio.wav"
    dummy_audio.write_bytes(create_sample_wav_bytes())

    mock_dl.return_value = MediaInfo(
        id=track_id,
        title="Mock Video Title",
        audio_path=str(dummy_audio),
        video_path=None,
        duration=120.0,
        source_type="youtube",
    )

    stem_dir = tmp_path / "stems" / track_id
    stem_dir.mkdir(parents=True, exist_ok=True)
    vocals_path = str(stem_dir / "vocals.wav")
    drums_path = str(stem_dir / "drums.wav")
    bass_path = str(stem_dir / "bass.wav")
    other_path = str(stem_dir / "other.wav")

    mock_sep.return_value = StemResult(
        id=track_id,
        vocals_path=vocals_path,
        drums_path=drums_path,
        bass_path=bass_path,
        other_path=other_path,
        is_cached=False,
    )

    response = client.post("/api/process/youtube", json={"url": url})
    assert response.status_code == 200
    data = response.json()

    assert "task_id" in data
    assert data["status"] == "processing"
    assert data["track_id"] == track_id

    # Give background thread time to process
    time.sleep(0.3)

    task = task_manager.get_task(data["task_id"])
    assert task is not None
    assert task.track_id == track_id


def test_upload_endpoint_validation():
    """Verify input validation on POST /api/process/upload."""
    # Empty file
    response = client.post(
        "/api/process/upload",
        files={"file": ("empty.wav", b"", "audio/wav")},
    )
    assert response.status_code == 400


@patch("backend.app.api.routes_process.save_uploaded_media")
@patch("backend.app.api.routes_process.separate_audio_stems")
def test_upload_endpoint_success(mock_sep, mock_save, tmp_path):
    """Verify POST /api/process/upload handles file and launches separation."""
    wav_bytes = create_sample_wav_bytes(duration_sec=0.5)
    dummy_audio = tmp_path / "uploaded_audio.wav"
    dummy_audio.write_bytes(wav_bytes)

    mock_save.return_value = MediaInfo(
        id="upload_test_hash_1",
        title="uploaded_audio",
        audio_path=str(dummy_audio),
        video_path=None,
        duration=0.5,
        source_type="upload",
    )

    mock_sep.return_value = StemResult(
        id="upload_test_hash_1",
        vocals_path=str(tmp_path / "vocals.wav"),
        drums_path=str(tmp_path / "drums.wav"),
        bass_path=str(tmp_path / "bass.wav"),
        other_path=str(tmp_path / "other.wav"),
        is_cached=False,
    )

    response = client.post(
        "/api/process/upload",
        files={"file": ("test_track.wav", wav_bytes, "audio/wav")},
    )
    assert response.status_code == 200
    data = response.json()

    assert "task_id" in data
    assert data["status"] == "processing"
    assert "track_id" in data

    time.sleep(0.3)
    task = task_manager.get_task(data["task_id"])
    assert task is not None


def test_sse_status_streaming_completed_task():
    """Verify GET /api/process/status/{task_id} SSE streaming output for completed task."""
    task_id = "test_sse_task_1"
    track_id = "test_track_sse"

    stem_result = StemResult(
        id=track_id,
        vocals_path="C:/stems/vocals.wav",
        drums_path="C:/stems/drums.wav",
        bass_path="C:/stems/bass.wav",
        other_path="C:/stems/other.wav",
        is_cached=False,
    )

    task_manager.update_task(
        task_id=task_id,
        stage="ready",
        progress=100.0,
        message="Separation complete",
        result=stem_result,
        track_id=track_id,
    )

    response = client.get(f"/api/process/status/{task_id}")
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]

    body = response.text
    assert body.startswith("data: ")
    lines = [line for line in body.split("\n") if line.startswith("data: ")]
    assert len(lines) >= 1

    event_data = json.loads(lines[0][len("data: ") :])
    assert event_data["stage"] == "ready"
    assert event_data["progress"] == 100.0
    assert event_data["result"]["id"] == track_id


def test_sse_status_not_found():
    """Verify 404 for unknown task_id in status endpoint."""
    response = client.get("/api/process/status/non_existent_task_999")
    assert response.status_code == 404


def test_track_info_endpoint(tmp_path: Path, monkeypatch):
    """Verify GET /api/process/info/{track_id} returns track details and stem URLs."""
    stems_test_dir = tmp_path / "stems"
    downloads_test_dir = tmp_path / "downloads"
    stems_test_dir.mkdir(parents=True, exist_ok=True)
    downloads_test_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr("backend.app.api.routes_process.STEMS_DIR", stems_test_dir)
    monkeypatch.setattr("backend.app.services.cache.STEMS_DIR", stems_test_dir)
    monkeypatch.setattr("backend.app.api.routes_process.DOWNLOADS_DIR", downloads_test_dir)

    track_id = "test_info_track_42"

    # Track not found test
    res_404 = client.get(f"/api/process/info/{track_id}")
    assert res_404.status_code == 404

    # Create dummy stems
    track_stems = stems_test_dir / track_id
    track_stems.mkdir(parents=True, exist_ok=True)
    for stem_name in ("vocals", "drums", "bass", "other"):
        (track_stems / f"{stem_name}.wav").write_bytes(b"RIFF" + b"\x00" * 50)

    # Create dummy video in downloads
    track_dl = downloads_test_dir / track_id
    track_dl.mkdir(parents=True, exist_ok=True)
    (track_dl / "video.mp4").write_bytes(b"\x00" * 100)

    res = client.get(f"/api/process/info/{track_id}")
    assert res.status_code == 200
    data = res.json()

    assert data["track_id"] == track_id
    assert data["status"] == "ready"
    assert data["has_video"] is True
    assert data["video_url"] == f"/api/media/video/{track_id}"
    assert "vocals" in data["stems"]
    assert data["stems"]["vocals"] == f"/api/media/stems/{track_id}/vocals"
    assert "drums" in data["stems"]
    assert "bass" in data["stems"]
    assert "other" in data["stems"]


def test_media_stems_endpoint(tmp_path: Path, monkeypatch):
    """Verify GET /api/media/stems/{track_id}/{stem_name} serves audio and supports range requests."""
    stems_test_dir = tmp_path / "stems"
    stems_test_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr("backend.app.api.routes_media.STEMS_DIR", stems_test_dir)
    monkeypatch.setattr("backend.app.services.cache.STEMS_DIR", stems_test_dir)

    track_id = "test_media_track_1"
    track_dir = stems_test_dir / track_id
    track_dir.mkdir(parents=True, exist_ok=True)

    wav_content = b"RIFF" + b"\x01\x02\x03\x04" * 50
    (track_dir / "vocals.wav").write_bytes(wav_content)

    # 1. Successful stream with name
    res = client.get(f"/api/media/stems/{track_id}/vocals")
    assert res.status_code == 200
    assert res.headers["content-type"] == "audio/wav"
    assert res.content == wav_content
    assert res.headers.get("accept-ranges") == "bytes"

    # 2. Successful stream with extension
    res = client.get(f"/api/media/stems/{track_id}/vocals.wav")
    assert res.status_code == 200
    assert res.content == wav_content

    # 3. HTTP Range Request (Partial Content)
    res_range = client.get(
        f"/api/media/stems/{track_id}/vocals",
        headers={"Range": "bytes=0-9"},
    )
    assert res_range.status_code == 206
    assert len(res_range.content) == 10
    assert res_range.content == wav_content[:10]
    assert "bytes 0-9/" in res_range.headers.get("content-range", "")

    # 4. Invalid stem name
    res_invalid = client.get(f"/api/media/stems/{track_id}/invalid_synth")
    assert res_invalid.status_code == 400

    # 5. Missing stem
    res_missing = client.get(f"/api/media/stems/{track_id}/drums")
    assert res_missing.status_code == 404


def test_media_video_endpoint(tmp_path: Path, monkeypatch):
    """Verify GET /api/media/video/{track_id} serves muted video and 404s when missing."""
    downloads_test_dir = tmp_path / "downloads"
    downloads_test_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr("backend.app.api.routes_media.DOWNLOADS_DIR", downloads_test_dir)

    track_id = "test_video_track_99"
    track_dir = downloads_test_dir / track_id
    track_dir.mkdir(parents=True, exist_ok=True)

    dummy_mp4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 200
    (track_dir / "video.mp4").write_bytes(dummy_mp4)

    # 1. Success video stream
    res = client.get(f"/api/media/video/{track_id}")
    assert res.status_code == 200
    assert res.headers["content-type"] == "video/mp4"
    assert res.content == dummy_mp4
    assert res.headers.get("accept-ranges") == "bytes"

    # 2. Missing video for unknown track
    res_missing = client.get("/api/media/video/non_existent_video_track")
    assert res_missing.status_code == 404
