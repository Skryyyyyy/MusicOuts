import asyncio
import json
import logging
from pathlib import Path
from typing import Optional
import uuid

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from backend.app.config import DOWNLOADS_DIR, STEMS_DIR
from backend.app.schemas.models import (
    MediaInfo,
    PreviewResponse,
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
    slice_audio,
)
from backend.app.services.separator import separate_audio_stems
from backend.app.services.task_manager import task_manager

logger = logging.getLogger("musicouts.api.process")

router = APIRouter(prefix="/process", tags=["process"])


def _run_youtube_pipeline(
    task_id: str,
    url: Optional[str] = None,
    start_time: Optional[float] = None,
    end_time: Optional[float] = None,
    existing_track_id: Optional[str] = None,
):
    """Background worker executing YouTube download followed by Demucs stem separation."""
    try:
        media_info = None

        # 1. If existing track ID provided and audio exists, reuse it
        if existing_track_id:
            src_audio = DOWNLOADS_DIR / existing_track_id / "audio.wav"
            if src_audio.exists() and src_audio.stat().st_size > 0:
                src_video = DOWNLOADS_DIR / existing_track_id / "video.mp4"
                import soundfile as sf
                dur = float(sf.info(str(src_audio)).duration)
                media_info = MediaInfo(
                    id=existing_track_id,
                    title=existing_track_id,
                    audio_path=str(src_audio),
                    video_path=str(src_video) if src_video.exists() else None,
                    duration=dur,
                    source_type="youtube",
                )

        if not media_info:
            if not url:
                raise ValueError("Neither url nor existing track_id audio was found")

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

            # Download & normalize audio/video
            media_info = download_from_youtube(url, progress_hook=yt_dlp_progress_hook)

        base_track_id = media_info.id
        effective_audio_path = media_info.audio_path
        target_track_id = base_track_id

        # 2. Check if timeline range slicing is requested
        if start_time is not None and end_time is not None and end_time > start_time:
            st = max(0.0, float(start_time))
            et = float(end_time)
            target_track_id = f"{base_track_id}_slice_{int(st)}_{int(et)}"
            sliced_dir = DOWNLOADS_DIR / target_track_id
            sliced_wav = sliced_dir / "audio.wav"

            task_manager.update_task(
                task_id=task_id,
                stage="downloading",
                progress=90.0,
                message=f"Trimming selected range ({st:.1f}s - {et:.1f}s)...",
                track_id=target_track_id,
            )

            if not sliced_wav.exists() or sliced_wav.stat().st_size == 0:
                sliced_ok = slice_audio(Path(media_info.audio_path), sliced_wav, st, et)
                if not sliced_ok:
                    raise RuntimeError(f"Failed to slice audio range {st}-{et}")

            effective_audio_path = str(sliced_wav)

        task_manager.update_task(
            task_id=task_id,
            stage="downloading",
            progress=100.0,
            message="Audio prepared successfully",
            track_id=target_track_id,
        )

        # 3. Check if stems already cached
        cached_stems = get_cached_stems(target_track_id)
        if cached_stems is not None:
            task_manager.update_task(
                task_id=task_id,
                stage="ready",
                progress=100.0,
                message="Retrieved isolated stems from cache",
                result=cached_stems,
                track_id=target_track_id,
            )
            return

        # 4. Demucs separation
        def sep_progress_callback(pct: float, msg: str):
            task_manager.update_task(
                task_id=task_id,
                stage="separating",
                progress=round(pct * 100.0, 1),
                message=msg,
                track_id=target_track_id,
            )

        task_manager.update_task(
            task_id=task_id,
            stage="separating",
            progress=0.0,
            message="Initializing Demucs neural separation pipeline...",
            track_id=target_track_id,
        )

        stem_result = separate_audio_stems(
            audio_path=effective_audio_path,
            track_id=target_track_id,
            progress_callback=sep_progress_callback,
        )

        task_manager.update_task(
            task_id=task_id,
            stage="ready",
            progress=100.0,
            message="Stem separation completed successfully",
            result=stem_result,
            track_id=target_track_id,
        )

    except Exception as e:
        logger.exception(f"YouTube processing error for task {task_id}: {e}")
        task_manager.update_task(
            task_id=task_id,
            stage="error",
            progress=0.0,
            message=f"Failed to process audio: {str(e)}",
        )


def _run_upload_pipeline(
    task_id: str,
    track_id: str,
    filename: str,
    file_bytes: bytes,
    start_time: Optional[float] = None,
    end_time: Optional[float] = None,
):
    """Background worker executing file upload saving followed by Demucs stem separation."""
    try:
        base_track_id = track_id
        target_track_id = base_track_id

        if start_time is not None and end_time is not None and end_time > start_time:
            target_track_id = f"{base_track_id}_slice_{int(start_time)}_{int(end_time)}"

        # Check if already cached
        cached = get_cached_stems(target_track_id)
        if cached is not None:
            task_manager.update_task(
                task_id=task_id,
                stage="ready",
                progress=100.0,
                message="Retrieved isolated stems from cache",
                result=cached,
                track_id=target_track_id,
            )
            return

        task_manager.update_task(
            task_id=task_id,
            stage="downloading",
            progress=20.0,
            message="Saving and normalizing uploaded audio...",
            track_id=target_track_id,
        )

        media_info = save_uploaded_media(filename, file_bytes)
        effective_audio_path = media_info.audio_path

        # Slice if requested
        if start_time is not None and end_time is not None and end_time > start_time:
            st = max(0.0, float(start_time))
            et = float(end_time)
            sliced_dir = DOWNLOADS_DIR / target_track_id
            sliced_wav = sliced_dir / "audio.wav"
            task_manager.update_task(
                task_id=task_id,
                stage="downloading",
                progress=80.0,
                message=f"Trimming uploaded audio ({st:.1f}s - {et:.1f}s)...",
                track_id=target_track_id,
            )
            if not sliced_wav.exists() or sliced_wav.stat().st_size == 0:
                sliced_ok = slice_audio(Path(media_info.audio_path), sliced_wav, st, et)
                if not sliced_ok:
                    raise RuntimeError(f"Failed to slice audio range {st}-{et}")
            effective_audio_path = str(sliced_wav)

        task_manager.update_task(
            task_id=task_id,
            stage="downloading",
            progress=100.0,
            message="Uploaded file saved and normalized",
            track_id=target_track_id,
        )

        def sep_progress_callback(pct: float, msg: str):
            task_manager.update_task(
                task_id=task_id,
                stage="separating",
                progress=round(pct * 100.0, 1),
                message=msg,
                track_id=target_track_id,
            )

        task_manager.update_task(
            task_id=task_id,
            stage="separating",
            progress=0.0,
            message="Initializing Demucs neural separation pipeline...",
            track_id=target_track_id,
        )

        stem_result = separate_audio_stems(
            audio_path=effective_audio_path,
            track_id=target_track_id,
            progress_callback=sep_progress_callback,
        )

        task_manager.update_task(
            task_id=task_id,
            stage="ready",
            progress=100.0,
            message="Stem separation completed successfully",
            result=stem_result,
            track_id=target_track_id,
        )

    except Exception as e:
        logger.exception(f"Upload processing error for task {task_id}: {e}")
        task_manager.update_task(
            task_id=task_id,
            stage="error",
            progress=0.0,
            message=f"Failed to process uploaded file: {str(e)}",
            track_id=target_track_id,
        )


@router.post("/preview", response_model=PreviewResponse)
@router.post("/preview-url", response_model=PreviewResponse)
async def preview_media(req: ProcessRequest):
    """
    Downloads source audio/video and returns preview details including audio URL and duration.
    Does NOT start Demucs stem separation, allowing the user to select a timeline range first.
    """
    if not req.url or not req.url.strip():
        raise HTTPException(status_code=400, detail="Media URL is required")

    clean_url = req.url.strip()
    try:
        media_info = await asyncio.to_thread(download_from_youtube, clean_url)
        return PreviewResponse(
            track_id=media_info.id,
            title=media_info.title,
            duration=media_info.duration,
            audio_url=f"/api/media/source/{media_info.id}",
            video_url=f"/api/media/video/{media_info.id}" if media_info.video_path else None,
            has_video=bool(media_info.video_path),
        )
    except Exception as e:
        logger.exception(f"Preview failed for URL {clean_url}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to extract media preview: {str(e)}")


@router.post("/preview-upload", response_model=PreviewResponse)
async def preview_upload(file: UploadFile = File(...)):
    """
    Saves uploaded file and returns preview details for interactive timeline range selection.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        media_info = await asyncio.to_thread(save_uploaded_media, file.filename, file_bytes)
        return PreviewResponse(
            track_id=media_info.id,
            title=media_info.title,
            duration=media_info.duration,
            audio_url=f"/api/media/source/{media_info.id}",
            video_url=f"/api/media/video/{media_info.id}" if media_info.video_path else None,
            has_video=bool(media_info.video_path),
        )
    except Exception as e:
        logger.exception(f"Upload preview failed for file {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process upload preview: {str(e)}")


@router.post("/youtube", response_model=ProcessResponse)
@router.post("/separate", response_model=ProcessResponse)
async def process_youtube(req: ProcessRequest):
    """
    Ingests a YouTube URL or pre-downloaded track_id, with optional start_time and end_time range,
    starts background download/trim and Demucs stem separation, and returns a task identifier for SSE.
    """
    if (not req.url or not req.url.strip()) and not req.track_id:
        raise HTTPException(status_code=400, detail="Either URL or track_id is required")

    task_id = str(uuid.uuid4())
    url_clean = req.url.strip() if req.url else None

    # Derive initial track ID
    initial_track_id: Optional[str] = req.track_id
    if not initial_track_id and url_clean:
        try:
            info = extract_youtube_info(url_clean)
            initial_track_id = info["id"]
        except Exception:
            initial_track_id = get_media_hash(url_clean)

    effective_track_id = initial_track_id
    if req.start_time is not None and req.end_time is not None and req.end_time > req.start_time:
        if initial_track_id:
            effective_track_id = f"{initial_track_id}_slice_{int(req.start_time)}_{int(req.end_time)}"

    task_manager.create_task(task_id=task_id, track_id=effective_track_id)

    # Check if already cached
    if effective_track_id and get_cached_stems(effective_track_id):
        cached = get_cached_stems(effective_track_id)
        task_manager.update_task(
            task_id=task_id,
            stage="ready",
            progress=100.0,
            message="Retrieved isolated stems from cache",
            result=cached,
            track_id=effective_track_id,
        )
    else:
        # Dispatch background separation worker
        asyncio.create_task(
            asyncio.to_thread(
                _run_youtube_pipeline,
                task_id,
                url_clean,
                req.start_time,
                req.end_time,
                req.track_id,
            )
        )

    return ProcessResponse(
        task_id=task_id,
        status="processing",
        track_id=effective_track_id,
    )


@router.post("/upload", response_model=ProcessResponse)
async def process_upload(
    file: UploadFile = File(...),
    start_time: Optional[float] = Form(None),
    end_time: Optional[float] = Form(None),
):
    """
    Receives an uploaded audio/video file, normalizes it, and starts background
    Demucs stem separation with optional timeline range selection.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    track_id = get_media_hash(file_bytes)
    effective_track_id = track_id
    if start_time is not None and end_time is not None and end_time > start_time:
        effective_track_id = f"{track_id}_slice_{int(start_time)}_{int(end_time)}"

    task_id = str(uuid.uuid4())
    task_manager.create_task(task_id=task_id, track_id=effective_track_id)

    # Check if already cached
    cached = get_cached_stems(effective_track_id)
    if cached is not None:
        task_manager.update_task(
            task_id=task_id,
            stage="ready",
            progress=100.0,
            message="Retrieved isolated stems from cache",
            result=cached,
            track_id=effective_track_id,
        )
    else:
        # Dispatch background separation worker
        asyncio.create_task(
            asyncio.to_thread(
                _run_upload_pipeline,
                task_id,
                track_id,
                file.filename,
                file_bytes,
                start_time,
                end_time,
            )
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

    duration = getattr(cached, "duration", 0.0) or 0.0
    if duration <= 0:
        for p in stem_paths.values():
            if p and Path(p).exists():
                try:
                    import soundfile as sf
                    duration = round(sf.info(p).duration, 2)
                    break
                except Exception:
                    pass

    return TrackInfoResponse(
        track_id=track_id,
        status="ready",
        title=track_id,
        duration=duration,
        stems=stems,
        stem_paths=stem_paths,
        video_url=f"/api/media/video/{track_id}" if has_video else None,
        has_video=has_video,
    )
