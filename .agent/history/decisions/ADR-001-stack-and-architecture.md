# ADR-001: Architecture, Tech Stack, and Foundation Blueprint

## Context
MusicOuts requires a non-destructive, video NLE-style music editing architecture with DAW-grade audio performance. The editor must run smoothly on Windows and cross-platform environments, maintaining sample accuracy, lock-free real-time preview, identical offline export graph rendering, and responsive multi-resolution waveform visualization.

## Decision
1. **Core & UI Stack**:
   - Modern React + TypeScript + Vite with a modular core architecture (`core/`, `apps/`, `ml/`, `tests/`).
   - Web Audio API real-time graph with lock-free parameter automation, matched 1:1 with `OfflineAudioContext` for bit-perfect offline exports.
   - Canvas/WebGL-based multi-resolution peak pyramid renderer for smooth 60fps timeline scrubbing and zooming.
2. **Data & EDL Model**:
   - Immutable `SourceAsset` files identified by SHA-256 / content hashes.
   - Non-destructive `Clip` instances referencing `sourceIn`/`sourceOut` ranges within tracks.
   - Command pattern with reversible atomic operations (`SplitClipCommand`, `MoveClipCommand`, `SetFadeCommand`, etc.) and undo/redo tree.
3. **Keyframe Automation**:
   - Multi-lane keyframing per clip/track/bus (Volume, Pan, EQ, Reverb Send, Filter).
   - Curve types: `linear`, `hold`, `bezier` (cubic control points), `ease`.

## Consequences
- Clean separation between UI representation and audio engine state.
- Seamless ability to bundle as a standalone desktop app via Tauri 2 or run in pro web environments.
- Ready for Phase 2 Editing, Phase 3 Keyframe expansion, Phase 4 Analysis, and Phase 5 Stem Lab integration.
