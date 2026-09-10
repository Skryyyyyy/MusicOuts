import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from backend.app.config import DOWNLOADS_DIR, STEMS_DIR
from backend.app.services.cache import get_cached_stems

logger = logging.getLogger("musicouts.api.media")

router = APIRouter(prefix="/media", tags=["media"])

VALID_STEM_NAMES = {"vocals", "drums", "bass", "other"}


@router.get("/video/{track_id}")
@router.get("/{track_id}/video")
def get_source_video(track_id: str):
    """
    Streams muted source video file (MP4/WebM) with HTTP Range support.
    """
    track_dl_dir = DOWNLOADS_DIR / track_id
    if not track_dl_dir.exists() or not track_dl_dir.is_dir():
        raise HTTPException(
            status_code=404,
            detail=f"Video media directory not found for track '{track_id}'",
        )

    video_candidates = [
        track_dl_dir / "video.mp4",
        track_dl_dir / "raw_video.mp4",
        track_dl_dir / "video.webm",
        track_dl_dir / "raw_video.webm",
        track_dl_dir / "video.mkv",
    ]

    matched_video: Optional[Path] = None
    for cand in video_candidates:
        if cand.exists() and cand.is_file() and cand.stat().st_size > 0:
            matched_video = cand
            break

    if not matched_video:
        raise HTTPException(
            status_code=404,
            detail=f"Muted video file not found for track '{track_id}'",
        )

    ext = matched_video.suffix.lower()
    media_type = "video/webm" if ext == ".webm" else "video/mp4"

    return FileResponse(
        path=matched_video,
        media_type=media_type,
        filename=f"{track_id}_video{ext}",
        headers={"Accept-Ranges": "bytes"},
    )


@router.get("/stems/{track_id}/{stem_name}")
@router.get("/{track_id}/{stem_name}")
def get_stem_audio(track_id: str, stem_name: str):
    """
    Streams separated audio stem (vocals, drums, bass, other) with HTTP Range support.
    """
    clean_stem = Path(stem_name).stem.lower()

    if clean_stem not in VALID_STEM_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid stem name '{stem_name}'. Valid stems are: {sorted(list(VALID_STEM_NAMES))}",
        )

    track_stems_dir = STEMS_DIR / track_id
    matched_path: Optional[Path] = None

    # Check for direct files in stem directory
    for ext in (".wav", ".mp3", ".flac", ".ogg", ".m4a"):
        candidate = track_stems_dir / f"{clean_stem}{ext}"
        if candidate.exists() and candidate.is_file() and candidate.stat().st_size > 0:
            matched_path = candidate
            break

    # Fallback to manifest if direct path not found
    if not matched_path:
        cached = get_cached_stems(track_id)
        if cached:
            path_attr = f"{clean_stem}_path"
            target_path_str = getattr(cached, path_attr, None)
            if target_path_str:
                candidate = Path(target_path_str)
                if candidate.exists() and candidate.is_file() and candidate.stat().st_size > 0:
                    matched_path = candidate

    if not matched_path or not matched_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Stem '{clean_stem}' not found for track '{track_id}'",
        )

    ext = matched_path.suffix.lower()
    media_type_map = {
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".flac": "audio/flac",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
    }
    media_type = media_type_map.get(ext, "audio/wav")

    return FileResponse(
        path=matched_path,
        media_type=media_type,
        filename=f"{clean_stem}{ext}",
        headers={"Accept-Ranges": "bytes"},
    )


@router.get("/source/{track_id}")
@router.get("/{track_id}/source")
def get_source_audio(track_id: str):
    """
    Streams downloaded or uploaded raw normalized audio file for preview waveform playback.
    """
    track_dl_dir = DOWNLOADS_DIR / track_id
    if not track_dl_dir.exists() or not track_dl_dir.is_dir():
        raise HTTPException(
            status_code=404,
            detail=f"Source audio directory not found for track '{track_id}'",
        )

    audio_candidates = [
        track_dl_dir / "audio.wav",
        track_dl_dir / "audio.mp3",
        track_dl_dir / "audio.flac",
        track_dl_dir / "audio.ogg",
        track_dl_dir / "audio.m4a",
        track_dl_dir / "raw_audio.wav",
    ]

    matched_audio: Optional[Path] = None
    for cand in audio_candidates:
        if cand.exists() and cand.is_file() and cand.stat().st_size > 0:
            matched_audio = cand
            break

    if not matched_audio:
        raise HTTPException(
            status_code=404,
            detail=f"Source audio file not found for track '{track_id}'",
        )

    ext = matched_audio.suffix.lower()
    media_type_map = {
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".flac": "audio/flac",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
    }
    media_type = media_type_map.get(ext, "audio/wav")

    return FileResponse(
        path=matched_audio,
        media_type=media_type,
        filename=f"{track_id}_source{ext}",
        headers={"Accept-Ranges": "bytes"},
    )

