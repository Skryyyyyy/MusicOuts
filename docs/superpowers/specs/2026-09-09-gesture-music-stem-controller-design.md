# Gesture-Controlled Music Stem Mixer & Video System (WalkOuts)
## Architectural Design Specification

**Date:** 2026-09-09  
**Status:** Approved for Implementation Planning  
**Target Directory:** `C:\SkryyyProjects\WalkOuts`  
**Target Hardware:** Windows 11, NVIDIA RTX 2050 (4GB VRAM), 8GB System RAM  

---

## 1. System Overview & Objectives
**WalkOuts** is an interactive web-based audio-visual experience that allows users to:
1. Provide a YouTube link or upload an audio/video file (`.mp3`, `.wav`, `.mp4`).
2. Automatically extract audio and run AI stem separation into 4 isolated audio channels: **Vocals**, **Drums**, **Bass**, and **Other (Melodic Instruments)**.
3. Synchronously play the separated stems alongside the source video or an audio-reactive visualizer.
4. Dynamically mix and modulate individual stems in real-time using:
   - **Webcam Hand Gestures** (via MediaPipe Hand Landmarker running client-side on WebGL).
   - **Interactive UI Controls** (faders, mute/solo toggles, DJ filter sweeps, and master volume).
5. Maintain an activity history and changelog under `docs/history/` detailing all architectural decisions, implementations, and verification steps.

---

## 2. Hardware-Aware Constraints & Architecture

### Target Specs:
- **GPU:** NVIDIA GeForce RTX 2050 Laptop GPU (~4GB VRAM).
- **RAM:** 8GB System Memory.

### Optimization Rules:
- **PyTorch Demucs Optimization:** Use `htdemucs` model with `--segment 7` (7-second chunks) and `fp16` half-precision to stay strictly below 2.5GB VRAM usage, preventing Out-Of-Memory (OOM) errors.
- **Client-Side Vision:** MediaPipe Hands runs 100% on the browser (WebAssembly/WebGL), offloading video gesture compute from the backend server.
- **WebAudio DSP:** Stems are decoded into in-memory `AudioBuffer`s and mixed via native Web Audio API nodes with microsecond-precision sync.

---

## 3. Directory Layout & Module Structure

```
C:\SkryyyProjects\WalkOuts\
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               # FastAPI application entrypoint & CORS config
│   │   ├── config.py             # System paths, CUDA flags, model configuration
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── routes_process.py # Ingestion endpoint (YouTube / Upload) + SSE progress stream
│   │   │   └── routes_media.py   # Streaming static stems & video tracks
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── downloader.py     # yt-dlp audio/video extraction & ffmpeg normalization
│   │   │   ├── separator.py      # Demucs PyTorch CUDA separation worker
│   │   │   └── cache.py          # MD5/YouTube-ID deduplication cache manager
│   │   └── schemas/
│   │       ├── __init__.py
│   │       └── models.py         # Pydantic request/response schemas
│   ├── requirements.txt
│   └── run_backend.py            # Local uvicorn launcher script
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── GestureHUD.tsx     # Webcam overlay, 21-point hand skeleton & gesture badges
│   │   │   ├── MixerDeck.tsx      # Multi-track stem faders, mute/solo, filter knobs
│   │   │   ├── VideoPlayer.tsx    # Synced video canvas / audio-reactive particle visualizer
│   │   │   ├── UrlUploader.tsx    # YouTube input & drag-and-drop file uploader with progress
│   │   │   └── MasterControls.tsx # Play, Pause, Seek, Loop, Master Volume
│   │   ├── engine/
│   │   │   ├── audioGraph.ts      # Web Audio API 4-stem synchronized DSP graph
│   │   │   ├── gestureTracker.ts  # MediaPipe HandLandmarker wrapper with exponential smoothing
│   │   │   └── visualizer.ts      # Real-time frequency spectrum & particle canvas renderer
│   │   ├── types/
│   │   │   └── index.ts          # TypeScript interfaces for stems, state, and gestures
│   │   ├── App.tsx               # Main layout & coordinator
│   │   ├── main.tsx              # React DOM root
│   │   └── index.css             # TailwindCSS base styles
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── tailwind.config.js
│
├── storage/                       # Local media cache (gitignored)
│   ├── downloads/                 # Raw audio/video files
│   └── stems/                     # Output separated stems (<id>/vocals.mp3, etc.)
│
└── docs/
    ├── history/                   # Persistent step-by-step activity and changelog
    │   └── 2026-09-09-project-init.md
    └── superpowers/
        └── specs/
            └── 2026-09-09-gesture-music-stem-controller-design.md
```

---

## 4. Subsystem Specifications

### Subsystem A: Ingestion & AI Stem Separation (Backend)
1. **Input Handling:**
   - **YouTube URL:** `yt-dlp` extracts audio (`44.1kHz stereo wav`) and saves muted video stream (`mp4`).
   - **File Upload:** Uploaded `.mp3`, `.wav`, `.mp4` files are validated and normalized with `ffmpeg`.
2. **Caching:** MD5 hash of input or YouTube ID is checked before running model. If already processed, instantly returns cached URLs.
3. **Demucs Separation Pipeline:**
   - Runs `htdemucs` with PyTorch `cuda:0` and `torch.cuda.amp.autocast()`.
   - Output stems saved as standard MP3/WAV:
     - `vocals.mp3`
     - `drums.mp3`
     - `bass.mp3`
     - `other.mp3`
4. **SSE Status Stream (`/api/process/status/{task_id}`):**
   - Yields JSON progress events: `{"stage": "downloading"|"separating"|"ready", "progress": 45.0}`.

---

### Subsystem B: WebAudio DSP Graph (Frontend)
1. **Multi-Track Audio Engine (`audioGraph.ts`):**
   - An `AudioContext` initializes 4 sub-graphs, one for each stem.
   - Each channel contains:
     ```
     [AudioBufferSourceNode] 
           │
           ▼
     [BiquadFilterNode] (Lowpass / Highpass DJ sweep)
           │
           ▼
     [GainNode] (Per-channel volume 0.0 - 1.5)
           │
           ▼
     [AnalyserNode] (For visualizer frequency data)
           │
           ▼
     [Master GainNode] ──► [AudioContext.destination]
     ```
2. **Phase Lock & Sync:**
   - Play, pause, seek, and loop operations dispatch synchronously using exact `AudioContext.currentTime` offsets.
   - HTML5 `<video>` playback rate and current time are locked to the `AudioContext` clock.

---

### Subsystem C: Hand Tracking & Gesture Engine (`gestureTracker.ts`)
1. **Model:** `@mediapipe/tasks-vision` `HandLandmarker` initialized in `VIDEO` mode running at 60 FPS.
2. **Coordinate Smoothing:** Applies Exponential Moving Average (EMA) to landmark coordinates (`alpha = 0.35`) to eliminate jitter.
3. **Gesture Mappings:**
   - **Left Hand Height ($Y_{wrist}$ / $Y_{index}$):** Controls **Vocals Gain** ($0.0 \leftrightarrow 1.2$).
   - **Right Hand Height ($Y_{wrist}$ / $Y_{index}$):** Controls **Instruments / Other Gain** ($0.0 \leftrightarrow 1.2$).
   - **Left Hand Pinch ($Distance(Thumb_{tip}, Index_{tip}) < threshold$):** **Solo Vocals** (mutes Drums, Bass, Other).
   - **Right Hand Horizontal Position ($X_{wrist}$):** Controls **Biquad DJ Filter** (Left = Low-pass cutoff $200\text{Hz} \dots 20\text{kHz}$; Right = High-pass sweep).
   - **Dual Closed Fists ($Hand_{closed} == true$ on both):** **Master Cut / Kill Switch** (instant silent drop).

---

### Subsystem D: User Interface & Deck (`MixerDeck.tsx`, `GestureHUD.tsx`)
1. **HUD Overlay:** Semi-transparent webcam view showing 21 skeleton keypoints per hand with real-time active gesture badges (e.g. `VOCALS: 80%`, `SOLO ACTIVE`, `DJ FILTER: 2.4 kHz`).
2. **Manual Controls:** Sliders, Mute/Solo toggle buttons, and rotary knobs for users who want to fine-tune without camera.
3. **Visualizer / Video Stage:** Full-width synchronized video player or audio-reactive canvas with frequency bars reacting to stem amplitudes.

---

## 5. Verification & Testing Strategy
1. **Backend Verification:**
   - Unit test for `downloader.py` checking successful media extraction.
   - Unit test for `separator.py` using a short 5-second test audio snippet, verifying CUDA execution, output files (`vocals`, `drums`, `bass`, `other`), and non-empty file sizes.
   - API integration test using FastAPI `TestClient` for `/api/process` and `/api/media`.
2. **Frontend Verification:**
   - Web Audio test verifying 4 buffers load and start simultaneously without drift.
   - MediaPipe gesture detection unit test verifying coordinate-to-gain mapping functions.
   - UI component render and user interaction verification.

---

## 6. History & Activity Tracking Protocol
All engineering actions, step completions, and design adjustments will be recorded chronologically in `docs/history/` to maintain a clear trail of implementation.
