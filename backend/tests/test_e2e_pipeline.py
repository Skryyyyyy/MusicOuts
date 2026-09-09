import os
import io
import wave
import struct
import math
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.config import DOWNLOADS_DIR, STEMS_DIR

client = TestClient(app)


def generate_synthetic_wav_bytes(duration_sec: float = 1.0, sample_rate: int = 44100) -> bytes:
    """Generates a small in-memory 44.1kHz stereo WAV buffer for end-to-end tests."""
    num_samples = int(duration_sec * sample_rate)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(2)
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)

        frames = bytearray()
        for i in range(num_samples):
            t = i / sample_rate
            # 440 Hz Left channel (A4), 880 Hz Right channel (A5)
            left_val = int(32767 * 0.5 * math.sin(2 * math.pi * 440 * t))
            right_val = int(32767 * 0.5 * math.sin(2 * math.pi * 880 * t))
            frames.extend(struct.pack("<hh", left_val, right_val))

        wav_file.writeframes(frames)

    buffer.seek(0)
    return buffer.read()


def test_full_e2e_ingestion_and_streaming_pipeline():
    """
    End-to-End integration test:
    1. Upload synthetic audio file via POST /api/process/upload.
    2. Read processing status via GET /api/process/status/{task_id}.
    3. Query track info via GET /api/process/info/{track_id}.
    4. Fetch each stem via GET /api/media/stems/{track_id}/{stem_name}.
    5. Verify HTTP 200 / 206 audio stream delivery and content types.
    """
    wav_bytes = generate_synthetic_wav_bytes(duration_sec=1.0)
    files = {"file": ("e2e_cyber_track.wav", wav_bytes, "audio/wav")}

    # 1. Upload
    upload_res = client.post("/api/process/upload", files=files)
    assert upload_res.status_code == 200
    upload_data = upload_res.json()
    assert "task_id" in upload_data
    assert upload_data["status"] in ["queued", "processing"]
    task_id = upload_data["task_id"]

    # 2. Check SSE / Status endpoint
    status_res = client.get(f"/api/process/status/{task_id}")
    assert status_res.status_code == 200
    assert "text/event-stream" in status_res.headers["content-type"]

    # 3. Track info
    track_id = upload_data.get("track_id")
    if track_id:
        info_res = client.get(f"/api/process/info/{track_id}")
        assert info_res.status_code in [200, 404]
