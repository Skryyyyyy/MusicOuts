import os
from pathlib import Path

# Base Directories
APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

STORAGE_DIR = PROJECT_ROOT / "storage"
DOWNLOADS_DIR = STORAGE_DIR / "downloads"
STEMS_DIR = STORAGE_DIR / "stems"

# Ensure directories exist
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
STEMS_DIR.mkdir(parents=True, exist_ok=True)

# Device Detection
def get_device() -> str:
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"

def get_device_info() -> dict:
    try:
        import torch
        cuda_avail = torch.cuda.is_available()
        cpu_threads = os.cpu_count() or 4
        if cuda_avail:
            device_name = torch.cuda.get_device_name(0)
            vram_total_gb = round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 1)
        else:
            device_name = f"CPU ({cpu_threads} Threads)"
            vram_total_gb = 0.0

        try:
            import psutil
            ram_gb = round(psutil.virtual_memory().total / (1024**3), 1)
        except Exception:
            ram_gb = 8.0

        return {
            "device": "cuda" if cuda_avail else "cpu",
            "cuda_available": cuda_avail,
            "device_name": device_name,
            "vram_gb": vram_total_gb,
            "device_count": torch.cuda.device_count() if cuda_avail else 0,
            "cpu_threads": cpu_threads,
            "ram_gb": ram_gb,
        }
    except Exception as e:
        return {
            "device": "cpu",
            "cuda_available": False,
            "device_name": "CPU System",
            "vram_gb": 0.0,
            "device_count": 0,
            "cpu_threads": os.cpu_count() or 4,
            "ram_gb": 8.0,
        }

DEVICE = get_device()

# Demucs & ML Config
DEMUCS_MODEL = os.getenv("DEMUCS_MODEL", "htdemucs")
SEGMENT_SIZE = int(os.getenv("DEMUCS_SEGMENT_SIZE", "7"))
USE_FLOAT16 = DEVICE == "cuda"

# Server Config
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*",
]
