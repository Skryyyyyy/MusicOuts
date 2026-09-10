import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

import { GestureHUD } from './GestureHUD';
import { MixerDeck } from './MixerDeck';
import { VideoPlayer } from './VideoPlayer';
import { UrlUploader } from './UrlUploader';
import { MasterControls } from './MasterControls';
import { DawTransport } from './DawTransport';
import { ArrangementView } from './ArrangementView';
import { DawInspector } from './DawInspector';
import { MixConsoleView } from "./views/MixConsoleView";
import { GestureLabView } from "./views/GestureLabView";
import { VisualStageView } from "./views/VisualStageView";
import { DemixLabView } from "./views/DemixLabView";
import { VirtualSynth } from "./VirtualSynth";
import { StudioGuideModal } from "./StudioGuideModal";
import { FxRackView } from "./views/FxRackView";
import { CapturePerformanceModal } from "./CapturePerformanceModal";
import { KeyframeLaneOverlay } from "./KeyframeLaneOverlay";
import { StemType, StemState, GestureState, TrackMetadata, DEFAULT_FX_RACK_STATE } from '../types';
import { DEFAULT_GESTURE_STATE } from '../engine/gestureTracker';

const MOCK_STEM_STATES: Record<StemType, StemState> = {
  vocals: { volume: 0.85, muted: false, solo: false, pan: 0.0 },
  drums: { volume: 0.90, muted: false, solo: false, pan: 0.0 },
  bass: { volume: 0.80, muted: false, solo: false, pan: 0.0 },
  other: { volume: 0.75, muted: false, solo: false, pan: 0.0 },
};

const MOCK_TRACK: TrackMetadata = {
  id: 'track-cyber-123',
  title: 'Neon Cyber Anthem',
  duration: 215,
  hasVideo: true,
  videoUrl: '/api/media/track-cyber-123/video',
  stems: {
    vocals: '/api/media/track-cyber-123/vocals',
    drums: '/api/media/track-cyber-123/drums',
    bass: '/api/media/track-cyber-123/bass',
    other: '/api/media/track-cyber-123/other',
  },
};

describe('UI Studio Deck Components', () => {
  describe('GestureHUD Component', () => {
    it('renders inactive standby state when isEnabled is false', () => {
      const html = renderToString(
        React.createElement(GestureHUD, {
          gestureTracker: null,
          gestureState: DEFAULT_GESTURE_STATE,
          isEnabled: false,
          onToggleEnabled: vi.fn(),
        })
      );

      expect(html).toContain('Vision HUD / Skeleton Tracker');
      expect(html).toContain('Webcam Gesture Tracking Inactive');
      expect(html).toContain('Activate Spatial Vision');
    });

    it('renders telemetry badges when isEnabled is true and active gestures present', () => {
      const activeState: GestureState = {
        leftHand: { present: true, height: 0.82, isPinching: true, isFist: false, x: 0.3, y: 0.18 },
        rightHand: { present: true, height: 0.65, isPinching: false, isFist: false, x: 0.85, y: 0.35 },
        isDualFist: false,
        djFilterCutoff: 4500,
        djFilterType: 'highpass',
      };

      const html = renderToString(
        React.createElement(GestureHUD, {
          gestureTracker: null,
          gestureState: activeState,
          isEnabled: true,
          onToggleEnabled: vi.fn(),
        })
      );

      expect(html).toContain('LEFT HAND');
      expect(html).toContain('VOCALS:');
      expect(html).toContain('82%');
      expect(html).toContain('SOLO ACTIVE (PINCH)');
      expect(html).toContain('RIGHT HAND');
      expect(html).toContain('INSTRUMENTS:');
      expect(html).toContain('65%');
      expect(html).toMatch(/4\.5.*kHz/);
      expect(html).toContain('HP');
    });

    it('renders dual fist master kill switch banner when triggered', () => {
      const killState: GestureState = {
        leftHand: { present: true, height: 0.5, isPinching: false, isFist: true, x: 0.3, y: 0.5 },
        rightHand: { present: true, height: 0.5, isPinching: false, isFist: true, x: 0.7, y: 0.5 },
        isDualFist: true,
        djFilterCutoff: 20000,
        djFilterType: 'lowpass',
      };

      const html = renderToString(
        React.createElement(GestureHUD, {
          gestureTracker: null,
          gestureState: killState,
          isEnabled: true,
          onToggleEnabled: vi.fn(),
        })
      );

      expect(html).toContain('MASTER KILL SWITCH ENGAGED (DUAL FIST)');
    });
  });

  describe('MixerDeck Component', () => {
    it('renders 4 stem channel strips + 1 master channel strip', () => {
      const html = renderToString(
        React.createElement(MixerDeck, {
          audioGraph: null,
          stemStates: MOCK_STEM_STATES,
          masterVolume: 1.0,
          djFilterCutoff: 20000,
          djFilterType: 'lowpass',
          djFilterQ: 1.0,
          onStemVolumeChange: vi.fn(),
          onStemMuteToggle: vi.fn(),
          onStemSoloToggle: vi.fn(),
          onStemPanChange: vi.fn(),
          onMasterVolumeChange: vi.fn(),
        })
      );

      expect(html).toContain('4-Channel Stem Mixer Deck');
      expect(html).toContain('Vocals');
      expect(html).toContain('Drums');
      expect(html).toContain('Bass');
      expect(html).toContain('Other');
      expect(html).toContain('MASTER');
      expect(html).toContain('DJ Biquad Filter Sweep');
      expect(html).toMatch(/LOWPASS.*MODE/);
      expect(html).toMatch(/20\.00.*kHz/);
    });

    it('reflects muted and soloed visual button styles', () => {
      const customStates: Record<StemType, StemState> = {
        ...MOCK_STEM_STATES,
        vocals: { volume: 0.8, muted: false, solo: true, pan: -0.2 },
        drums: { volume: 0.5, muted: true, solo: false, pan: 0.5 },
      };

      const html = renderToString(
        React.createElement(MixerDeck, {
          audioGraph: null,
          stemStates: customStates,
          masterVolume: 0.8,
          djFilterCutoff: 12000,
          djFilterType: 'highpass',
          djFilterQ: 2.5,
          onStemVolumeChange: vi.fn(),
          onStemMuteToggle: vi.fn(),
          onStemSoloToggle: vi.fn(),
          onStemPanChange: vi.fn(),
          onMasterVolumeChange: vi.fn(),
        })
      );

      expect(html).toMatch(/HIGHPASS.*MODE/);
      expect(html).toMatch(/12\.00.*kHz/);
      expect(html).toMatch(/Q:.*2\.5/);
      expect(html).toContain('L20');
      expect(html).toContain('R50');
    });
  });

  describe('VideoPlayer Component', () => {
    it('renders visualizer mode selector buttons and canvas stage', () => {
      const html = renderToString(
        React.createElement(VideoPlayer, {
          audioGraph: null,
          trackMetadata: MOCK_TRACK,
          currentTime: 42,
          isPlaying: true,
        })
      );

      expect(html).toContain('Reactive Audio Stage');
      expect(html).toContain('Neon Cyber Anthem');
      expect(html).toContain('Bars');
      expect(html).toContain('Radial');
      expect(html).toContain('Scope');
      expect(html).toContain('Video');
      expect(html).toContain('Vocals');
      expect(html).toContain('Drums');
      expect(html).toContain('Bass');
      expect(html).toContain('Other');
    });
  });

  describe('UrlUploader Component', () => {
    it('renders YouTube input, file dropzone, and sample presets', () => {
      const html = renderToString(
        React.createElement(UrlUploader, {
          onTrackLoaded: vi.fn(),
          onStatusChange: vi.fn(),
        })
      );

      expect(html).toContain('Demucs Neural Stem Ingestion');
      expect(html).toContain('Paste YouTube music or video URL...');
      expect(html).toContain('Pick Timeline Range');
      expect(html).toContain('Demix Full');
      expect(html).toMatch(/Drag &amp; drop audio file/);
      expect(html).toContain('Synthwave Cyber Anthem');
      expect(html).toContain('Future Bass Drop');
    });
  });

  describe('MasterControls Component', () => {
    it('renders transport buttons, seek bar, time format, and hardware indicators', () => {
      const html = renderToString(
        React.createElement(MasterControls, {
          isPlaying: false,
          currentTime: 85,
          duration: 215,
          isLooping: true,
          isReady: true,
          isDucking: true,
          duckingReduction: 0.35,
          onPlayToggle: vi.fn(),
          onSeek: vi.fn(),
          onReset: vi.fn(),
          onLoopToggle: vi.fn(),
          onDuckingToggle: vi.fn(),
        })
      );

      expect(html).toContain('1:25'); // 85s
      expect(html).toContain('3:35'); // 215s
      expect(html).toContain('CUDA GPU');
      expect(html).toContain('12ms');
      expect(html).toContain('Loop Enabled');
      expect(html).toMatch(/DUCKING.*ON/);
      expect(html).toContain('VOCALS WAVEFORM');
    });

    it('renders playing pause button state and ducking off state', () => {
      const html = renderToString(
        React.createElement(MasterControls, {
          isPlaying: true,
          currentTime: 0,
          duration: 180,
          isLooping: false,
          isReady: true,
          isDucking: false,
          duckingReduction: 1.0,
          onPlayToggle: vi.fn(),
          onSeek: vi.fn(),
          onReset: vi.fn(),
          onLoopToggle: vi.fn(),
          onDuckingToggle: vi.fn(),
        })
      );

      expect(html).toContain('Pause Playback');
      expect(html).toContain('0:00');
      expect(html).toContain('3:00');
      expect(html).toMatch(/DUCKING.*OFF/);
    });
  });

  describe('DawTransport Component', () => {
    it('renders master timecode LCD, tempo/sig, transport controls, and volume faders', () => {
      const html = renderToString(
        React.createElement(DawTransport, {
          isPlaying: false,
          currentTime: 65.5,
          duration: 180,
          isLooping: true,
          isReady: true,
          masterVolume: 0.85,
          djFilterCutoff: 15000,
          djFilterType: 'lowpass',
          isDucking: true,
          duckingReduction: 0.5,
          hardwareInfo: {
            device: 'cuda',
            cuda_available: true,
            device_name: 'NVIDIA RTX 2050',
            vram_gb: 4,
            device_count: 1,
            cpu_threads: 12,
            ram_gb: 16,
          },
          onPlayToggle: vi.fn(),
          onStop: vi.fn(),
          onSeek: vi.fn(),
          onReset: vi.fn(),
          onLoopToggle: vi.fn(),
          onDuckingToggle: vi.fn(),
          onMasterVolumeChange: vi.fn(),
          onDjFilterChange: vi.fn(),
          canUndo: true,
          canRedo: true,
          onUndo: vi.fn(),
          onRedo: vi.fn(),
        })
      );

      expect(html).toContain('MusicOuts');
      expect(html).toContain('01:05.50');
      expect(html).toContain('PLAY');
      expect(html).toContain('CUDA');
      expect(html).toContain('DUCK:');
      expect(html).toContain('UNDO');
      expect(html).toContain('REDO');
    });
  });

  describe('ArrangementView Component', () => {
    it('renders 4 stem track lanes with channel badges, solo/mute buttons, and waveform canvas containers', () => {
      const html = renderToString(
        React.createElement(ArrangementView, {
          audioGraph: null,
          trackMetadata: MOCK_TRACK,
          currentTime: 45,
          duration: 215,
          isPlaying: true,
          isLooping: false,
          stemStates: MOCK_STEM_STATES,
          onSeek: vi.fn(),
          onStemVolumeChange: vi.fn(),
          onStemMuteToggle: vi.fn(),
          onStemSoloToggle: vi.fn(),
          onStemPanChange: vi.fn(),
          onResetStemKeyframes: vi.fn(),
          onResetAllKeyframes: vi.fn(),
        })
      );

      expect(html).toContain('Arrangement Timeline');
      expect(html).toContain('01 VOCALS [LEAD]');
      expect(html).toContain('02 DRUMS [PERC]');
      expect(html).toContain('03 BASS [LOW-END]');
      expect(html).toContain('04 OTHER [SYNTH &amp; INST]');
      expect(html).toContain('CH 01 • STEREO BUS');
      expect(html).toContain('CH 02 • STEREO BUS');
      expect(html).toContain('H-ZOOM:');
      expect(html).toContain('RESET ALL KF');
      expect(html).toContain('RESET KF');
      expect(html).toContain('cursor-col-resize');
      expect(html).toContain('cursor-row-resize');
    });
  });

  describe('DawInspector Component', () => {
    it('renders drawer header tabs and collapsible container', () => {
      const html = renderToString(
        React.createElement(DawInspector, {
          audioGraph: null,
          gestureTracker: null,
          trackMetadata: MOCK_TRACK,
          currentTime: 10,
          isPlaying: false,
          stemStates: MOCK_STEM_STATES,
          masterVolume: 1.0,
          djFilterCutoff: 20000,
          djFilterType: 'lowpass',
          djFilterQ: 1.0,
          isGestureEnabled: false,
          gestureState: DEFAULT_GESTURE_STATE,
          onTrackLoaded: vi.fn(),
          onStatusChange: vi.fn(),
          onStemVolumeChange: vi.fn(),
          onStemMuteToggle: vi.fn(),
          onStemSoloToggle: vi.fn(),
          onStemPanChange: vi.fn(),
          onMasterVolumeChange: vi.fn(),
          onDjFilterChange: vi.fn(),
          onGestureStateChange: vi.fn(),
          onToggleGestureEnabled: vi.fn(),
        })
      );

      expect(html).toContain('Console Mixer');
      expect(html).toContain('Vision HUD');
      expect(html).toContain('Reactive Stage');
      expect(html).toContain('Neural Ingestion');
      expect(html).toContain('4-Channel Stem Mixer Deck');
    });
  });
  describe("Dedicated Studio View Pages", () => {
    it("renders MixConsoleView with 4 channel strips and master bus", () => {
      const html = renderToString(
        React.createElement(MixConsoleView, {
          audioGraph: null,
          stemStates: MOCK_STEM_STATES,
          masterVolume: 1.0,
          djFilterCutoff: 20000,
          djFilterType: "lowpass",
          isDucking: true,
          duckingReduction: 0.75,
          onStemVolumeChange: vi.fn(),
          onStemMuteToggle: vi.fn(),
          onStemSoloToggle: vi.fn(),
          onStemPanChange: vi.fn(),
          onMasterVolumeChange: vi.fn(),
          onDjFilterChange: vi.fn(),
          onDuckingToggle: vi.fn(),
        })
      );

      expect(html).toContain("Splice Console");
      expect(html).toContain("VOCALS");
      expect(html).toContain("DRUMS");
      expect(html).toContain("BASS");
      expect(html).toContain("OTHER");
      expect(html).toContain("MAIN BUSS");
      expect(html).toContain("Auto-Ducking:");
      expect(html).toContain("ON");
    });

    it("renders GestureLabView with camera viewport and telemetry cards", () => {
      const html = renderToString(
        React.createElement(GestureLabView, {
          gestureTracker: null,
          gestureState: DEFAULT_GESTURE_STATE,
          isGestureEnabled: false,
          onToggleGestureEnabled: vi.fn(),
          onGestureStateChange: vi.fn(),
        })
      );

      expect(html).toContain("Spatial Gesture HUD");
      expect(html).toContain("Spatial Camera Viewport");
      expect(html).toContain("Live Modulation Telemetry");
      expect(html).toContain("Gesture Mapping Reference");
    });

    it("renders VisualStageView with reactive visualizer canvas and track metadata", () => {
      const html = renderToString(
        React.createElement(VisualStageView, {
          audioGraph: null,
          trackMetadata: MOCK_TRACK,
          currentTime: 30,
          isPlaying: true,
        })
      );

      expect(html).toContain("Audio-Reactive Stage");
      expect(html).toContain("Neon Cyber Anthem");
    });

    it("renders DemixLabView with ingestion lab and stem export buttons", () => {
      const html = renderToString(
        React.createElement(DemixLabView, {
          trackMetadata: MOCK_TRACK,
          processStatus: { stage: "ready", progress: 100, message: "Ready" },
          onTrackLoaded: vi.fn(),
          onStatusChange: vi.fn(),
        })
      );

      expect(html).toContain("Neural AI Demixer &amp; Media Ingestion Lab");
      expect(html).toContain("Track Analysis &amp; Stems");
      expect(html).toContain("Export Separated WAV Stems:");
      expect(html).toContain("Neon Cyber Anthem");
    });
    it("renders VirtualSynth with piano roll keys and instruments", () => {
      const html = renderToString(React.createElement(VirtualSynth, { audioGraph: null }));
      expect(html).toContain("Web Synth &amp; Live Piano Roll");
      expect(html).toContain("Cyber Lead");
      expect(html).toContain("Grand Piano");
      expect(html).toContain("808 Bass");
      expect(html).toContain("Warm Pad");
    });

    it("renders StudioGuideModal with quick guide and keyboard shortcuts", () => {
      const html = renderToString(React.createElement(StudioGuideModal, { isOpen: true, onClose: vi.fn() }));
      expect(html).toContain("MusicOuts Pro Studio • Quick Guide");
      expect(html).toContain("5 Dedicated Studio Workspaces");
      expect(html).toContain("Keyboard Shortcuts");
    });

    it("renders FxRackView with 5-insert effect slots and stem selector", () => {
      const html = renderToString(
        React.createElement(FxRackView, {
          audioGraph: null,
          fxRackState: DEFAULT_FX_RACK_STATE,
          onFxChange: vi.fn(),
        })
      );

      expect(html).toContain("Splice FX Rack");
      expect(html).toContain("3-Band EQ");
      expect(html).toContain("Compressor");
      expect(html).toContain("Space Reverb");
      expect(html).toContain("Stereo Delay");
      expect(html).toContain("Warm Drive");
    });

    it("renders CapturePerformanceModal with take details and checklist", () => {
      const html = renderToString(
        React.createElement(CapturePerformanceModal, {
          session: {
            id: 'perf_test_1234',
            title: 'Live Anthem Take',
            timestamp: new Date().toISOString(),
            duration: 195,
            totalGestures: 42,
            totalAutomationPoints: 120,
            scenesTriggered: ['DROP', 'VERSE'],
            events: [],
            projectSnapshot: {
              version: '1.1',
              title: 'Live Anthem Take',
              trackId: 'track_1',
              duration: 195,
              bpm: 120,
              key: 'A Minor',
              timeSignature: '4/4',
              mode: 'performance',
              stemStates: MOCK_STEM_STATES,
              fxRack: DEFAULT_FX_RACK_STATE,
              masterVolume: 1.0,
              djFilterCutoff: 20000,
              djFilterType: 'lowpass',
              isDucking: false,
              markers: [],
              automation: [],
              created: new Date().toISOString(),
            },
          },
          onClose: vi.fn(),
          onPlayTake: vi.fn(),
        })
      );

      expect(html).toContain("Performance Take Captured");
      expect(html).toContain("03:15");
      expect(html).toContain("42");
      expect(html).toContain("Playback Take");
      expect(html).toContain("Save Performance");
    });
  });

  describe('KeyframeLaneOverlay & Adobe Keyframing', () => {
    it('renders Adobe keyframe diamonds and rubber band SVG path', () => {
      const html = renderToString(
        React.createElement(KeyframeLaneOverlay, {
          target: 'vocals.volume',
          points: [
            { id: 'kf-1', time: 10, target: 'vocals.volume', value: 0.5, curve: 'bezier' },
            { id: 'kf-2', time: 30, target: 'vocals.volume', value: 1.2, curve: 'linear' },
            { id: 'kf-3', time: 60, target: 'vocals.volume', value: 0.8, curve: 'hold' },
          ],
          duration: 120,
          currentTime: 10,
          onAddPoint: vi.fn(),
          onUpdatePoint: vi.fn(),
          onDeletePoint: vi.fn(),
        })
      );

      expect(html).toContain('Adobe Keyframe Automation Lane');
      expect(html).toContain('<svg');
      expect(html).toContain('rotate-45'); // Adobe diamond rotation
      expect(html).toContain('grad-vocals_volume'); // Gradient shader
      expect(html).toContain('C 126.66'); // Adobe Bezier cubic curve segment in SVG path
      expect(html).toContain('bg-cyan-300'); // Inner Bezier indicator dot
      expect(html).toContain('bg-purple-400'); // Inner Hold indicator dot
    });

    it('ArrangementView renders Adobe keyframe navigator buttons and parameter selector when showAutomation is true', () => {
      const html = renderToString(
        React.createElement(ArrangementView, {
          audioGraph: null,
          trackMetadata: MOCK_TRACK,
          currentTime: 10,
          duration: 180,
          isPlaying: false,
          isLooping: false,
          stemStates: MOCK_STEM_STATES,
          showAutomation: true,
          automationPoints: [
            { id: 'kf-voc-1', time: 10, target: 'vocals.volume', value: 1.0, curve: 'bezier' },
          ],
          onSeek: vi.fn(),
          onStemVolumeChange: vi.fn(),
          onStemMuteToggle: vi.fn(),
          onStemSoloToggle: vi.fn(),
          onStemPanChange: vi.fn(),
        })
      );

      expect(html).toContain('Vol (Level)');
      expect(html).toContain('BEZ'); // Bezier easing pill
      expect(html).toContain('Adobe Keyframe Automation Lane');
    });

    it('ArrangementView renders Stem & Clip Reversal and Arrangement Reverb Controls', () => {
      const html = renderToString(
        React.createElement(ArrangementView, {
          audioGraph: null,
          trackMetadata: MOCK_TRACK,
          currentTime: 10,
          duration: 180,
          isPlaying: false,
          isLooping: false,
          stemStates: MOCK_STEM_STATES,
          fxRackState: DEFAULT_FX_RACK_STATE,
          clips: [
            {
              id: 'clip-test-1',
              name: 'Lead Vocals Slice',
              songId: 'song-1',
              songTitle: 'Test Song',
              stem: 'vocals',
              startTime: 10,
              sourceOffset: 0,
              duration: 30,
              gain: 1,
              muted: false,
              isReversed: true,
            },
          ],
          onSeek: vi.fn(),
          onStemVolumeChange: vi.fn(),
          onStemMuteToggle: vi.fn(),
          onStemSoloToggle: vi.fn(),
          onStemPanChange: vi.fn(),
          onToggleReverseStem: vi.fn(),
          onToggleReverseClip: vi.fn(),
          onReverseAllStems: vi.fn(),
          onStemReverbChange: vi.fn(),
          onStemReverbPresetChange: vi.fn(),
          onStemReverbToggle: vi.fn(),
          canUndo: true,
          canRedo: true,
          onUndo: vi.fn(),
          onRedo: vi.fn(),
        })
      );

      // Verify Reverse All Stems button
      expect(html).toContain('⇄ REV ALL');
      // Verify Stem reverse toggle
      expect(html).toContain('⇄ REV');
      // Verify Undo / Redo toolbar buttons
      expect(html).toContain('↶ UNDO');
      expect(html).toContain('↷ REDO');
      // Verify Stem Reverb strip
      expect(html).toContain('REV');
      expect(html).toContain('WET');
      expect(html).toContain('Hall');
      expect(html).toContain('Plate');
      expect(html).toContain('Cathedral');
      expect(html).toContain('Rev Swell');
    });
  });
});
