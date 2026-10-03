# ADR-002: Apple-Grade 4-Region Landscape Layout Architecture

## Context
MusicOuts required a tablet-first (iPad landscape) architecture scaling up to desktop, implementing a calm, tactile 4-region layout with DAW-grade DSP and NLE workflow principles.

## Decision
1. **Region 1: Top Bar**:
   - Exit navigation pill + contextual menus (File, Edit, View, Settings, Help).
   - Dynamic editable project title, timestamped last saved state.
   - BPM with Tap-Tempo detection and time signature indicators.
   - Central floating transport pill containing Play/Stop/Record (red pulse) with high-contrast monospace timecode (`00:00.0`).
   - Action toggles for Loop, Playhead Split (scissors tool), Stem/Waveform view, Mic input, and Master Volume slider.
2. **Region 2: Left Column (Track List + Library)**:
   - Split vertically with draggable smooth divider handle.
   - Top Track List: Multi-view tabs (Tracks, Mixer, Waves, Samples), Mute/Solo/Record indicator dots, track colored icon tile, thin real-time stereo meter bars, automation lane toggle thumbnail, and full-width Add Track button.
   - Bottom Library: Quick navigation folders (Likes, All Samples), recently imported songs with BPM/Loop badges, and auto-detected song section chips (Intro, Verse, Chorus, Drop) with full drag-and-drop into timeline tracks.
3. **Region 3: Center Timeline**:
   - 1:1 row alignment with track list.
   - Ruler with dynamic Bar/Beat grid adapting to horizontal zoom level.
   - Playhead with high-precision white line and downward triangle grabber handle.
   - Rounded-corner track-colored clips with darker embedded waveform peak pyramids, bottom-left labels, trim handles, and non-destructive splitting.
   - Sub-track automation expansion lane with diamond keyframes and spline bezier curve rendering.
4. **Region 4: Bottom Effects Panel**:
   - Horizontal rack of vertical effect modules (Reverb, Delay, Compressor, Vinyl, Reverse, Equalizer, Neural Enhance, Spatial).
   - Green LED power indicators, rotated typography, and active mini levels.
   - Expanded detail card with live frequency response curve and tactile `RotaryKnob` controls supporting fine-adjust (Shift), double-click reset, and keyframe trigger.

## Consequences
- 100% compliance with reference specifications and Apple Human Interface Guidelines.
- Touch-friendly 44pt minimum targets and responsive scaling across iPad landscape and pro desktop displays.
