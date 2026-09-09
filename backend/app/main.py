from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api import media_router, process_router
from backend.app.config import CORS_ORIGINS, DEVICE, get_device_info

app = FastAPI(
    title="MusicOuts API",
    description="Backend API for MusicOuts - Spatial Gesture AI Music Workstation",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(process_router, prefix="/api")
app.include_router(media_router, prefix="/api")


@app.get("/")
def root():
    return {
        "name": "MusicOuts API",
        "version": "0.1.0",
        "status": "online",
        "docs_url": "/docs",
    }


@app.get("/api/health")
def health_check():
    device_info = get_device_info()
    return {
        "status": "ok",
        "device": DEVICE,
        "device_info": device_info,
    }
