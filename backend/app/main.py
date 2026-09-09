from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import CORS_ORIGINS, DEVICE, get_device_info

app = FastAPI(
    title="WalkOuts API",
    description="Backend API for WalkOuts - Gesture Music Stem Controller",
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


@app.get("/")
def root():
    return {
        "name": "WalkOuts API",
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
