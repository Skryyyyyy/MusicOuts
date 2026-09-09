# Gesture-Controlled Music Stem Mixer & Video System (WalkOuts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack, gesture-controlled music stem separation and audio-visual mixer web application that allows users to ingest YouTube links or audio files, separate them into 4 stems (Vocals, Drums, Bass, Other) using GPU-accelerated Demucs, and control/remix them in real time with webcam hand gestures and interactive mixer controls.

**Architecture:** A Python FastAPI backend with PyTorch CUDA (FP16 chunked Demucs) for AI stem separation and media extraction, combined with a React + Vite + TailwindCSS frontend that executes client-side MediaPipe Hand Landmarker vision at 60 FPS and a 4-channel Web Audio DSP graph with microsecond-accurate phase sync.

**Tech Stack:** Python 3.12, FastAPI, PyTorch (CUDA), Demucs (HTDemucs), yt-dlp, ffmpeg-python, React 18/19, TypeScript, Vite, TailwindCSS, Web Audio API, @mediapipe/tasks-vision, Lucide React.

**Spec:** `docs/superpowers/specs/2026-09-09-gesture-music-stem-controller-design.md`

## Global Constraints
- Target Hardware: Windows 11, NVIDIA RTX 2050 (4GB VRAM), 8GB System RAM.
- Demucs Memory Cap: Must use `htdemucs` with `--segment 7` and FP16 to keep VRAM strictly under 2.5GB.
- Client-Side Vision: Hand tracking must run entirely on the browser using MediaPipe WebGL to ensure 60 FPS and zero backend latency.
- Audio Phase Lock: All 4 audio stems must be decoded into `AudioBuffer` and started via shared `AudioContext.currentTime` timestamp.
- Audit Trail: Every completed task must append a log entry to `docs/history/`.

---

### Task 1: Backend Foundation & Virtual Environment Setup

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`
- Create: `backend/app/main.py`
- Create: `backend/run_backend.py`
- Test: `backend/tests/test_health.py`

**Interfaces:**
- Produces: `FastAPI` instance with CORS enabled for `http://localhost:5173`, serving health check at `GET /api/health`.

- [ ] **Step 1: Write requirements.txt with pinned dependencies**
```txt
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
pydantic>=2.9.0
yt-dlp>=2024.8.6
demucs>=4.0.1
torch>=2.4.0
torchaudio>=2.4.0
pytest>=8.3.0
httpx>=0.27.0
python-multipart>=0.0.9
```

- [ ] **Step 2: Create config.py with directories and CUDA auto-detection**
```python
from pathlib import Path
import torch

BASE_DIR = Path(__file__).resolve().parent.parent.parent
STORAGE_DIR = BASE_DIR / "storage"
DOWNLOADS_DIR = STORAGE_DIR / "downloads"
STEMS_DIR = STORAGE_DIR / "stems"

DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
STEMS_DIR.mkdir(parents=True, exist_ok=True)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_NAME = "htdemucs"
SEGMENT_SIZE = 7
```

- [ ] **Step 3: Create FastAPI app in main.py and test_health.py**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="WalkOuts API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "device": "cuda" if torch.cuda.is_available() else "cpu"}
```

- [ ] **Step 4: Run pytest to verify health endpoint passes**
Run: `pytest backend/tests/test_health.py -v`
Expected: PASS

- [ ] **Step 5: Record history log in `docs/history/002-backend-setup.md`**

---

### Task 2: Ingestion & Downloader Service (YouTube + Local Media)

**Files:**
- Create: `backend/app/services/downloader.py`
- Create: `backend/app/schemas/models.py`
- Test: `backend/tests/test_downloader.py`

**Interfaces:**
- Consumes: `DOWNLOADS_DIR` from `config.py`.
- Produces: `MediaInfo(id=..., title=..., audio_path=..., video_path=..., duration=...)` from `downloader.download_from_youtube(url)` or `downloader.process_uploaded_file(file)`.

- [ ] **Step 1: Write failing test in test_downloader.py for media ingestion**
- [ ] **Step 2: Implement yt-dlp audio/video extraction in downloader.py**
- [ ] **Step 3: Implement file upload normalization in downloader.py**
- [ ] **Step 4: Run tests to verify audio extraction and media hashing**
Run: `pytest backend/tests/test_downloader.py -v`
Expected: PASS

---

### Task 3: Demucs AI Stem Separation Pipeline (RTX 2050 CUDA Optimized)

**Files:**
- Create: `backend/app/services/separator.py`
- Create: `backend/app/services/cache.py`
- Test: `backend/tests/test_separator.py`

**Interfaces:**
- Consumes: `audio_path: Path` from `downloader.py`.
- Produces: `StemResult(id=..., vocals=..., drums=..., bass=..., other=..., is_cached=...)`.

- [ ] **Step 1: Write test_separator.py using a 3-second generated sine-wave audio file**
- [ ] **Step 2: Implement Demucs separation wrapper with `--segment 7` and FP16 CUDA acceleration**
- [ ] **Step 3: Implement Stem Cache check in cache.py to skip duplicate separation**
- [ ] **Step 4: Run separator test and verify all 4 stems (vocals, drums, bass, other) are generated**
Run: `pytest backend/tests/test_separator.py -v`
Expected: PASS

---

### Task 4: Ingestion REST Endpoints & SSE Live Progress Streaming

**Files:**
- Create: `backend/app/api/routes_process.py`
- Create: `backend/app/api/routes_media.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_api.py`

**Interfaces:**
- Produces:
  - `POST /api/process/youtube` (Body: `{"url": "..."}`) -> `{ "task_id": "...", "status": "processing" }`
  - `POST /api/process/upload` (Multipart file) -> `{ "task_id": "...", "status": "processing" }`
  - `GET /api/process/status/{task_id}` (Server-Sent Events: progress stream)
  - `GET /api/media/{track_id}/{stem_name}` (Audio streaming with byte-range support)

- [ ] **Step 1: Write API tests in test_api.py**
- [ ] **Step 2: Implement routes_process.py with background task queue and progress pub/sub**
- [ ] **Step 3: Implement routes_media.py for fast static audio and video serving**
- [ ] **Step 4: Run test_api.py and verify endpoints**
Run: `pytest backend/tests/test_api.py -v`
Expected: PASS

---

### Task 5: Frontend Scaffolding (Vite + React + TailwindCSS)

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/src/index.css`
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/main.tsx`

**Interfaces:**
- Produces: Responsive cyberpunk/studio mixer UI foundation with dark mode, glowing accents, and typed interfaces for tracks, stems, gestures, and audio status.

- [ ] **Step 1: Initialize Vite React TypeScript project in `frontend/`**
- [ ] **Step 2: Install dependencies: `@mediapipe/tasks-vision`, `lucide-react`, `tailwindcss`, `clsx`**
- [ ] **Step 3: Configure Tailwind theme with audio-meter color gradients and neon studio styling**
- [ ] **Step 4: Verify frontend build compiles with `npm run build`**
Run: `npm --prefix frontend run build`
Expected: Success with 0 errors

---

### Task 6: Web Audio 4-Track DSP Graph Engine

**Files:**
- Create: `frontend/src/engine/audioGraph.ts`
- Test: `frontend/src/engine/audioGraph.test.ts`

**Interfaces:**
- Produces `AudioGraphEngine` class:
  - `loadStems(urls: StemUrls): Promise<void>`
  - `play(offsetSeconds?: number): void`
  - `pause(): void`
  - `seek(seconds: number): void`
  - `setStemVolume(stem: 'vocals'|'drums'|'bass'|'other', volume: number): void`
  - `setStemSolo(stem: 'vocals'|'drums'|'bass'|'other', solo: boolean): void`
  - `setStemMute(stem: 'vocals'|'drums'|'bass'|'other', mute: boolean): void`
  - `setDjFilter(cutoffHz: number, type: 'lowpass'|'highpass'): void`
  - `getFrequencyData(stem?: string): Uint8Array`

- [ ] **Step 1: Implement AudioGraphEngine with 4-track AudioBufferSourceNode sync**
- [ ] **Step 2: Wire independent GainNodes, BiquadFilterNodes, and AnalyserNodes**
- [ ] **Step 3: Implement master seek and loop synchronizer**
- [ ] **Step 4: Unit test audio graph initialization and volume/filter node mappings**

---

### Task 7: MediaPipe Hand Tracking & Gesture Engine

**Files:**
- Create: `frontend/src/engine/gestureTracker.ts`
- Create: `frontend/src/types/gestures.ts`

**Interfaces:**
- Produces `GestureTracker` class:
  - `initialize(videoElement: HTMLVideoElement): Promise<void>`
  - `startTracking(onFrame: (gestureState: GestureState) => void): void`
  - `stopTracking(): void`
- Calculates:
  - `leftHandHeight`: normalized $0.0 \dots 1.0$ (Vocals Gain)
  - `rightHandHeight`: normalized $0.0 \dots 1.0$ (Instruments Gain)
  - `isLeftPinching`: boolean (Solo Vocals)
  - `rightHandX`: normalized $-1.0 \dots 1.0$ (DJ Filter cutoff)
  - `isDualFist`: boolean (Master Kill/Drop)

- [ ] **Step 1: Download MediaPipe Hand Landmarker WASM/model assets**
- [ ] **Step 2: Implement exponential moving average (EMA) smoothing for 21 3D hand keypoints**
- [ ] **Step 3: Implement Euclidean distance calculations for pinch, fist, and palm detection**
- [ ] **Step 4: Verify 60 FPS tracking callback without UI thread lag**

---

### Task 8: UI Components: Gesture HUD, Mixer Deck, and Video/Visualizer Stage

**Files:**
- Create: `frontend/src/components/GestureHUD.tsx`
- Create: `frontend/src/components/MixerDeck.tsx`
- Create: `frontend/src/components/VideoPlayer.tsx`
- Create: `frontend/src/components/UrlUploader.tsx`
- Create: `frontend/src/components/MasterControls.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Connects `audioGraph.ts`, `gestureTracker.ts`, and backend API into an intuitive, polished studio dashboard.

- [ ] **Step 1: Build UrlUploader.tsx with YouTube URL parser, file dropzone, and live SSE progress meter**
- [ ] **Step 2: Build GestureHUD.tsx with real-time canvas drawing 21-point hand skeleton + active gesture badges**
- [ ] **Step 3: Build MixerDeck.tsx with 4 dynamic VU meters, vertical faders, solo/mute toggles, and DJ filter knob**
- [ ] **Step 4: Build VideoPlayer.tsx with synchronized video stream or audio-reactive particle visualizer**
- [ ] **Step 5: Wire App.tsx coordinator for seamless gesture and manual control**

---

### Task 9: End-to-End Integration, Verification & Documentation

**Files:**
- Modify: `docs/history/` (Append all milestone logs)
- Create: `README.md` (Full setup and quickstart guide)

- [ ] **Step 1: Run end-to-end test ingesting a YouTube link / audio file**
- [ ] **Step 2: Verify GPU Demucs separation and stem delivery**
- [ ] **Step 3: Verify gesture tracking triggers real-time audio stem volume and filter changes**
- [ ] **Step 4: Update README.md and complete the history log in `docs/history/`**
