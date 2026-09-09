from typing import Optional
from pydantic import BaseModel, Field


class MediaInfo(BaseModel):
    id: str = Field(..., description="Unique identifier for the media track")
    title: str = Field(..., description="Title of the media track")
    audio_path: str = Field(..., description="Absolute path to the extracted/normalized audio file")
    video_path: Optional[str] = Field(None, description="Absolute path to the video file if available")
    duration: float = Field(0.0, description="Duration of the audio/video in seconds")
    source_type: str = Field(..., description="Source type: 'youtube' or 'upload'")


class ProcessRequest(BaseModel):
    url: Optional[str] = Field(None, description="YouTube URL to process")


class ProcessResponse(BaseModel):
    task_id: str = Field(..., description="Unique processing task identifier")
    status: str = Field(..., description="Task status: e.g. 'queued', 'processing', 'completed', 'failed'")
    media_info: Optional[MediaInfo] = Field(None, description="Media information if available")


class StemResult(BaseModel):
    id: str = Field(..., description="Track or separation identifier")
    vocals_path: str = Field(..., description="Path to isolated vocals audio stem")
    drums_path: str = Field(..., description="Path to isolated drums audio stem")
    bass_path: str = Field(..., description="Path to isolated bass audio stem")
    other_path: str = Field(..., description="Path to isolated other (instruments) audio stem")
    is_cached: bool = Field(False, description="True if loaded from existing stem cache")
