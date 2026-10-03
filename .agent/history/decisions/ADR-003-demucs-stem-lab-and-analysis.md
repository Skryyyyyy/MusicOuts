# ADR-003: Local Demucs Integration, Stem Lab Architecture, and Audio Analysis Pipeline

## Context
MusicOuts needed an AI-powered stem separation engine utilizing the user's locally installed Demucs CLI (`C:\Users\BALAMURUGAN\AppData\Local\Programs\Python\Python313\Scripts\demucs.exe`), alongside client-side automatic BPM detection, beat grid generation, musical section segmentation, and non-destructive ripple editing.

## Decision
1. **Local Demucs Engine & Server Bridge**:
   - Built a local Python server bridge (`ml/stem-lab/server.py`) and TypeScript client (`ml/stem-lab/service.ts`).
   - Supports 2-stem (Vocals/Instrumental), 4-stem (`htdemucs`), and 6-stem (`htdemucs_6s`) separation with GPU/CPU acceleration.
   - Content-addressed disk caching (`.cache/stems/<hash>/`) prevents redundant re-computation.
   - Client-side fallback decomposition ensures responsiveness across all environments.
2. **Auto Audio Analysis Pipeline**:
   - `detectBpmAndBeats`: Energy envelope and autocorrelation over downsampled audio buffers to estimate BPM and beat grid.
   - `detectSongSections`: RMS phrase energy dynamics segmenting tracks into Intro, Verse, Chorus, Drop, Bridge, and Outro sections.
3. **Non-Destructive EDL Ripple Editing**:
   - `RippleDeleteClipCommand` removes target clips while automatically shifting subsequent clips leftward on that track, maintaining timing continuity with invertible undo/redo support.

## Consequences
- Full seamless integration with local Demucs v4 CLI for DAW-grade stem separation.
- Users can import any audio file, automatically view BPM and draggable section chips, and split into linked stem tracks with one click.
