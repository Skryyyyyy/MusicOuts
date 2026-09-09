# WalkOuts Activity History

## Entry 008: MediaPipe Hand Tracking & Gesture Recognition Engine (`gestureTracker.ts`)
- **Date:** 2026-09-09
- **Author:** Antigravity AI Pair Programmer
- **Summary:**
  - Implemented real-time client-side Hand Tracking & Gesture Engine in `frontend/src/engine/gestureTracker.ts`:
    - **MediaPipe HandLandmarker Integration**: Initialized `@mediapipe/tasks-vision` `HandLandmarker` using vision WASM assets and float16 task bundle with GPU delegate and automatic CPU fallback.
    - **60 FPS Video Processing Loop**: Real-time `requestAnimationFrame` loop detecting up to 2 hands concurrently from `HTMLVideoElement` with mirror handling.
    - **Exponential Moving Average (EMA) Smoothing**: Applied coordinate smoothing ($\alpha = 0.35$) across all 21 3D skeleton keypoints per hand to eliminate camera jitter while maintaining high responsiveness.
    - **Fader & Audio Mapping**:
      - Left Hand height ($1.0 - y_{wrist}$) controls Vocals stem fader gain.
      - Right Hand height ($1.0 - y_{wrist}$) controls Instruments/Other stem fader gain.
    - **Left Hand Pinch Detection (Solo Vocals)**: 3D Euclidean distance calculation between Thumb Tip (Point 4) and Index Tip (Point 8) triggering solo vocal isolation when distance $< 0.06$.
    - **Right Hand X-Axis DJ Biquad Filter Sweep**:
      - $x < 0.45$: Low-pass filter frequency sweep ($200\text{Hz} \dots 20\text{kHz}$).
      - $0.45 \le x \le 0.55$: Center neutral bypass zone ($20\text{kHz}$ lowpass).
      - $x > 0.55$: High-pass filter frequency sweep ($20\text{Hz} \dots 5\text{kHz}$).
    - **Dual Closed Fist Kill Switch**: Distance check of fingertips (Points 8, 12, 16, 20) to wrist base (Point 0) $< 0.15$ simultaneously on both hands to trigger an instant master audio kill switch.
    - **Pure Geometry & Gesture Helpers**: Exported standalone pure math functions (`calculateEuclideanDistance`, `isPinchGesture`, `isFistGesture`, `mapXToDjFilter`, `applyEmaSmoothing`, `smoothLandmarks`) for decoupled testing and HUD visualizer rendering.
  - Implemented unit test suite in `frontend/src/engine/gestureTracker.test.ts`:
    - 23 unit tests verifying Euclidean distance formulas, pinch/fist threshold detection, DJ filter sweep boundaries, EMA convergence, frame processing, and tracker disposal.
    - Total test suite: 36/36 passing tests across all frontend engines.
  - Verified production build and TypeScript compilation with `npm --prefix frontend run build` (exit code 0).
