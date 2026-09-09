import asyncio
import json
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from backend.app.config import DOWNLOADS_DIR, STEMS_DIR
from backend.app.schemas.models import (
    ProcessRequest,
    ProcessResponse,
    TrackInfoResponse,
)
from backend.app.services.cache import get_cached_stems, get_stems_dir
from backend.app.services.downloader import (
    download_from_youtube,
    extract_youtube_info,
    get_media_hash,
    save_uploaded_media,
)
from backend.app.services.separator import separate_audio_stems
from backend.app.services.task_manager import task_manager

logger = logging.getLogger("musicouts.api.process")

router = APIRouter(prefix="/process", tags=["process"])


def _run_youtube_pipeline(task_id: str, url: str):
    """Background worker executing YouTube download followed by Demucs stem separation."""
    try:
        task_manager.update_task(
            task_id=task_id,
            stage="downloading",
            progress=5.0,
            message="Connecting to YouTube and extracting stream info...",
        )

        def yt_dlp_progress_hook(d: dict):
            if d.get("status") == "downloading":
                downloaded = d.get("downloaded_bytes", 0)
                total = d.get("total_bytes") or d.get("total_bytes_estimate") or 1
                pct = min(100.0, max(0.0, (downloaded / total) * 100.0))
                task_manager.update_task(
                    task_id=task_id,
                    stage="downloading",
                    progress=round(pct, 1),
                    message=f"Downloading media stream ({int(pct)}%)...",
                )
            elif d.get("status") == "finished":
                task_manager.update_task(
                    task_id=task_id,
                    stage="downloading",
                    progress=100.0,
                    message="Download finished. Preparing audio normalization...",
                )

        # 1. Download & normalize audio/video
        media_info = download_from_youtube(url, progress_hook=yt_dlp_progress_hook)
        track_id = media_info.id
        task_manager.update_task(
            task_id=task_id,
            stage="downloading",
            progress=100.0,
            message="Audio normalized successfully",
            track_id=track_id,
        )

        # 2. Check if stems already cached
        cached_stems = get_cached_stems(track_id)
        if cached_stems is not None:
            task_manager.update_task(
                task_id=task_id,
                stage="ready",
                progress=100.0,
                message="Retrieved isolated stems from cache",
                result=cached_stems,
                track_id=track_id,
            )
            return

        # 3. Demucs separation
        def sep_progress_callback(pct: float, msg: str):
            task_manager.update_task(
                task_id=task_id,
                stage="separating",
                progress=round(pct * 100.0, 1),
                message=msg,
                track_id=track_id,
            )

        task_manager.update_task(
            task_id=task_id,
            stage="separating",
            progress=0.0,
            message="Initializing Demucs neural separation pipeline...",
            track_id=track_id,
        )

        stem_result = separate_audio_stems(
            audio_path=media_info.audio_path,
            track_id=track_id,
            progress_callback=sep_progress_callback,
        )

        task_manager.update_task(
            task_id=task_id,
            stage="ready",
            progress=100.0,
            message="Stem separation completed successfully",
            result=stem_result,
            track_id=track_id,
        )

    except Exception as e:
        logger.exception(f"YouTube processing error for task {task_id}: {e}")
        task_manager.update_task(
            task_id=task_id,
            stage="error",
            progress=0.0,
            message=f"Failed to process YouTube URL: {str(e)}",
        )


def _run_upload_pipeline(task_id: str, track_id: str, filename: str, file_bytes: bytes):
    """Background worker executing file upload saving followed by Demucs stem separation."""
    try:
        # Check if already cached
        cached = get_cached_stems(track_id)
        if cached is not None:
            task_manager.update_task(
                task_id=task_id,
                stage="ready",
                progress=100.0,
                message="Retrieved isolated stems from cache",
                result=cached,
                track_id=track_id,
            )
            return

        task_manager.update_task(
            task_id=task_id,
            stage="downloading",
            progress=20.0,
            message="Saving and normalizing uploaded audio...",
            track_id=track_id,
        )

        media_info = save_uploaded_media(filename, file_bytes)

        task_manager.update_task(
            task_id=task_id,
            stage="downloading",
            progress=100.0,
            message="Uploaded file saved and normalized",
            track_id=track_id,
        )

        def sep_progress_callback(pct: float, msg: str):
            task_manager.update_task(
                task_id=task_id,
                stage="separating",
                progress=round(pct * 100.0, 1),
                message=msg,
                track_id=track_id,
            )

        task_manager.update_task(
            task_id=task_id,
            stage="separating",
            progress=0.0,
            message="Initializing Demucs neural separation pipeline...",
            track_id=track_id,
        )

        stem_result = separate_audio_stems(
            audio_path=media_info.audio_path,
            track_id=track_id,
            progress_callback=sep_progress_callback,
        )

        task_manager.update_task(
            task_id=task_id,
            stage="ready",
            progress=100.0,
            message="Stem separation completed successfully",
            result=stem_result,
            track_id=track_id,
        )

    except Exception as e:
        logger.exception(f"Upload processing error for task {task_id}: {e}")
        task_manager.update_task(
            task_id=task_id,
            stage="error",
            progress=0.0,
            message=f"Failed to process uploaded file: {str(e)}",
            track_id=track_id,
        )


@router.post("/youtube", response_model=ProcessResponse)
async def process_youtube(req: ProcessRequest):
    """
    Ingests a YouTube URL, starts background download and Demucs stem separation,
    and returns a task identifier for SSE status tracking.
    """
    if not req.url or not req.url.strip():
        raise HTTPException(status_code=400, detail="YouTube URL is required")

    task_id = str(uuid.uuid4())
    
    # Try quick video ID derivation for initial track_id
    initial_track_id: Optional[str] = None
    try:
        # Fast metadata extraction (no media download)
        info = extract_youtube_info(req.url.strip())
        initial_track_id = info["id"]
    except Exception:
        initial_track_id = get_media_hash(req.url.strip())

    task_manager.create_task(task_id=task_id, track_id=initial_track_id)

    # Check if already cached
    if initial_track_id and get_cached_stems(initial_track_id):
        cached = get_cached_stems(initial_track_id)
        task_manager.update_task(
            task_id=task_id,
            stage="ready",
            progress=100.0,
            message="Retrieved isolated stems from cache",
            result=cached,
            track_id=initial_track_id,
        )
    else:
        # Dispatch background separation worker
        asyncio.create_task(asyncio.to_thread(_run_youtube_pipeline, task_id, req.url.strip()))

    return ProcessResponse(
        task_id=task_id,
        status="processing",
        track_id=initial_track_id,
    )


@router.post("/upload", response_model=ProcessResponse)
async def process_upload(file: UploadFile = File(...)):
    """
    Receives an uploaded audio/video file, normalizes it, and starts background
    Demucs stem separation.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    track_id = get_media_hash(file_bytes)
    task_id = str(uuid.uuid4())

    task_manager.create_task(task_id=task_id, track_id=track_id)

    # Check if already cached
    cached = get_cached_stems(track_id)
    if cached is not None:
        task_manager.update_task(
            task_id=task_id,
            stage="ready",
            progress=100.0,
            message="Retrieved isolated stems from cache",
            result=cached,
            track_id=track_id,
        )
    else:
        # Dispatch background separation worker
        asyncio.create_task(
            asyncio.to_thread(_run_upload_pipeline, task_id, track_id, file.filename, file_bytes)
        )

    return ProcessResponse(
        task_id=task_id,
        status="processing",
        track_id=track_id,
    )


@router.get("/status/{task_id}")
@router.get("/{task_id}/events")
@router.get("/events/{task_id}")
async def get_task_status_sse(task_id: str, request: Request):
    """
    Server-Sent Events (SSE) live progress streaming endpoint for a given task_id.
    Yields JSON events indicating stage ('downloading', 'separating', 'ready', 'error') and percentage.
    """
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    async def event_generator():
        queue, initial_event = task_manager.subscribe(task_id)
        try:
            # Send initial state immediately
            yield f"data: {json.dumps(initial_event)}\n\n"

            if initial_event.get("stage") in ("ready", "error"):
                return

            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {json.dumps(event)}\n\n"
                    if event.get("stage") in ("ready", "error"):
                        break
                except asyncio.TimeoutError:
                    # Keep-alive heartbeat comment
                    yield ": keepalive\n\n"
        finally:
            task_manager.unsubscribe(task_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/info/{track_id}", response_model=TrackInfoResponse)
async def get_track_info(track_id: str):
    """
    Returns stem URLs, local paths, and metadata for a completed track.
    """
    cached = get_cached_stems(track_id)
    if not cached:
        raise HTTPException(
            status_code=404,
            detail=f"Track '{track_id}' not found or stems not yet generated",
        )

    # Check for video file in downloads
    track_dl_dir = DOWNLOADS_DIR / track_id
    video_path = track_dl_dir / "video.mp4"
    has_video = video_path.exists() and video_path.stat().st_size > 0

    stems = {
        "vocals": f"/api/media/stems/{track_id}/vocals",
        "drums": f"/api/media/stems/{track_id}/drums",
        "bass": f"/api/media/stems/{track_id}/bass",
        "other": f"/api/media/stems/{track_id}/other",
    }

    stem_paths = {
        "vocals": cached.vocals_path,
        "drums": cached.drums_path,
        "bass": cached.bass_path,
        "other": cached.other_path,
    }

    return TrackInfoResponse(
        track_id=track_id,
        status="ready",
        title=track_id,
        duration=0.0,
        stems=stems,
        stem_paths=stem_paths,
        video_url=f"/api/media/video/{track_id}" if has_video else None,
        has_video=has_video,
    )
