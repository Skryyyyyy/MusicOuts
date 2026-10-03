# MusicOuts Engineering Conventions & Guidelines

## 1. Non-Destructive EDL Model
- Source audio files (`SourceAsset`) are strictly immutable.
- Audio clips (`Clip`) reference source assets via `sourceId`, with `sourceIn` and `sourceOut` offsets (in seconds or sample counts).
- All timeline edits (split, crop, merge, ripple, slip, fade, mute, solo) are purely metadata mutations stored as atomic, reversible Commands.

## 2. Audio Graph & Processing Rules
- High-precision 32-bit floating point internal pipeline.
- Identical signal graph topology used for real-time preview (Web Audio / native DSP) and offline export renderers to guarantee bit-accurate parity.
- Sample-accurate keyframe automation interpolation (linear, hold, cubic bezier, ease-in-out).
- Zero audio thread blocking: heavy ML inference (Demucs stem splitting, neural enhancement) runs asynchronously via job queues with content-addressed cache hashes.

## 3. UI & Design Language (Apple Pro Aesthetics)
- SF Pro typography, 8pt spatial grid, generous breathing room.
- Dark-first aesthetic with translucent vibrancies and backdrop blurs.
- Subdued, distinct color palette for stems:
  - Vocals: Cyan / Azure
  - Drums: Amber / Gold
  - Bass: Magenta / Purple
  - Other / Synths / Guitars: Emerald / Teal
- 60 FPS smooth rendering for multi-resolution waveform pyramids.

## 4. Code Quality & Type Safety
- Strict TypeScript (`strict: true`, no implicit `any`).
- Full unit test coverage for EDL operations, command history undo/redo stacks, and DSP keyframe math.
- Versioned project serialization with schema migrations.
