from typing import Dict, Optional
from pydantic import BaseModel, Field


class MediaInfo(BaseModel):
    id: str = Field(..., description="Unique identifier for the media track")
    title: str = Field(..., description="Title of the media track")
    audio_path: str = Field(..., description="Absolute path to the extracted/normalized audio file")
    video_path: Optional[str] = Field(None, description="Absolute path to the video file if available")
    duration: float = Field(0.0, description="Duration of the audio/video in seconds")
    source_type: str = Field(..., description="Source type: 'youtube' or 'upload'")


class ProcessRequest(BaseModel):
    url: Optional[str] = Field(None, description="YouTube URL or media link to process")
    track_id: Optional[str] = Field(None, description="Pre-downloaded or existing media track ID")
    start_time: Optional[float] = Field(None, description="Start offset in seconds for timeline segment separation")
    end_time: Optional[float] = Field(None, description="End offset in seconds for timeline segment separation")


class PreviewResponse(BaseModel):
    track_id: str = Field(..., description="Track identifier for the previewed media")
    title: str = Field(..., description="Media title")
    duration: float = Field(0.0, description="Total media duration in seconds")
    audio_url: str = Field(..., description="URL to stream source audio for preview player")
    video_url: Optional[str] = Field(None, description="URL to stream source video if available")
    has_video: bool = Field(False, description="Whether source video is available")
    thumbnail: Optional[str] = Field(None, description="Thumbnail image URL if available")


class ProcessResponse(BaseModel):
    task_id: str = Field(..., description="Unique processing task identifier")
    status: str = Field(..., description="Task status: e.g. 'queued', 'processing', 'completed', 'failed'")
    track_id: Optional[str] = Field(None, description="Media track identifier if available")
    media_info: Optional[MediaInfo] = Field(None, description="Media information if available")


class StemResult(BaseModel):
    id: str = Field(..., description="Track or separation identifier")
    vocals_path: str = Field(..., description="Path to isolated vocals audio stem")
    drums_path: str = Field(..., description="Path to isolated drums audio stem")
    bass_path: str = Field(..., description="Path to isolated bass audio stem")
    other_path: str = Field(..., description="Path to isolated other (instruments) audio stem")
    is_cached: bool = Field(False, description="True if loaded from existing stem cache")
    duration: Optional[float] = Field(0.0, description="Duration of isolated stems in seconds")


class ProcessStatusEvent(BaseModel):
    stage: str = Field(..., description="Processing stage: 'downloading', 'separating', 'ready', 'error'")
    progress: float = Field(0.0, description="Progress percentage from 0.0 to 100.0")
    message: str = Field("", description="Human-readable status message")
    result: Optional[StemResult] = Field(None, description="Stem separation result if completed")


class TrackInfoResponse(BaseModel):
    track_id: str = Field(..., description="Track identifier")
    status: str = Field("ready", description="Track status")
    title: Optional[str] = Field(None, description="Track title")
    duration: Optional[float] = Field(0.0, description="Track duration in seconds")
    stems: Dict[str, str] = Field(..., description="Map of stem names to media URLs")
    stem_paths: Optional[Dict[str, str]] = Field(None, description="Map of stem names to local file paths")
    video_url: Optional[str] = Field(None, description="URL to stream video if available")
    has_video: bool = Field(False, description="Whether muted source video is available")
