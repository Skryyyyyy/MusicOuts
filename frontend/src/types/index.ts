/**
 * Core type definitions for MusicOuts Gesture Music Stem Mixer & DAW Studio
 */

export type StemType = 'vocals' | 'drums' | 'bass' | 'other';

export const STEM_TYPES: StemType[] = ['vocals', 'drums', 'bass', 'other'];

export type StudioView = 'arrangement' | 'mixer' | 'fxrack' | 'gesture' | 'visualizer' | 'ingestion';

export type StudioMode = 'performance' | 'producer';

export interface StemState {
  volume: number; // 0.0 to 1.0 (or higher if boosted)
  muted: boolean;
  solo: boolean;
  pan: number; // -1.0 (left) to 1.0 (right)
}

export interface TrackMetadata {
  id: string;
  title: string;
  duration: number;
  hasVideo: boolean;
  stems: Record<StemType, string>;
  videoUrl?: string;
  createdAt?: string;
}

export type ProcessStage = 'queued' | 'downloading' | 'separating' | 'ready' | 'error';

export interface ProcessStatus {
  stage: ProcessStage;
  progress: number; // 0 to 100
  message: string;
  result?: {
    track_id?: string;
    title?: string;
    duration?: number;
    has_video?: boolean;
    stems?: Record<string, string>;
    video_url?: string | null;
    [key: string]: unknown;
  };
}

export interface HandData {
  present: boolean;
  height: number; // 0.0 (bottom) to 1.0 (top)
  isPinching: boolean;
  isFist: boolean;
  x: number; // 0.0 (left) to 1.0 (right)
  y: number; // 0.0 (top) to 1.0 (bottom)
}

export interface GestureState {
  leftHand: HandData;
  rightHand: HandData;
  isDualFist: boolean;
  fistHoldProgress?: number; // 0.0 to 1.0 (hold countdown)
  djFilterCutoff: number; // in Hz (e.g., 20 to 20000)
  djFilterType: 'lowpass' | 'highpass';
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  masterVolume: number;
}

export interface HardwareInfo {
  device: 'cuda' | 'cpu';
  cuda_available: boolean;
  device_name: string;
  vram_gb: number;
  device_count: number;
  cpu_threads: number;
  ram_gb: number;
}

export interface TimelineMarker {
  id: string;
  name: string;
  time: number;
  color: string;
}

// ---------------- FX RACK TYPES ----------------

export interface StemEqConfig {
  enabled: boolean;
  lowGain: number; // -12dB to +12dB
  midGain: number; // -12dB to +12dB
  highGain: number; // -12dB to +12dB
  lowFreq: number; // e.g. 100Hz
  midFreq: number; // e.g. 1000Hz
  highFreq: number; // e.g. 8000Hz
}

export interface StemCompConfig {
  enabled: boolean;
  threshold: number; // -40dB to 0dB
  ratio: number; // 1 to 20
  attack: number; // 0.005 to 0.1s
  release: number; // 0.05 to 0.5s
  knee: number; // 0 to 40dB
}

export interface StemReverbConfig {
  enabled: boolean;
  decay: number; // 0.5s to 5.0s
  preDelay: number; // 0.0 to 0.1s
  mix: number; // 0.0 (dry) to 1.0 (wet)
}

export interface StemDelayConfig {
  enabled: boolean;
  time: number; // 0.05s to 1.0s (or tempo-synced subdivisions)
  feedback: number; // 0.0 to 0.85
  mix: number; // 0.0 to 1.0
}

export interface StemSaturationConfig {
  enabled: boolean;
  drive: number; // 0.0 to 1.0
  tone: number; // 0.0 (dark/warm) to 1.0 (bright)
  mix: number; // 0.0 to 1.0
}

export interface StemFxState {
  eq: StemEqConfig;
  compressor: StemCompConfig;
  reverb: StemReverbConfig;
  delay: StemDelayConfig;
  saturation: StemSaturationConfig;
}

export type FxRackState = Record<StemType, StemFxState>;

export const DEFAULT_STEM_FX: StemFxState = {
  eq: {
    enabled: true,
    lowGain: 0,
    midGain: 0,
    highGain: 0,
    lowFreq: 100,
    midFreq: 1000,
    highFreq: 8000,
  },
  compressor: {
    enabled: false,
    threshold: -18,
    ratio: 4,
    attack: 0.01,
    release: 0.15,
    knee: 10,
  },
  reverb: {
    enabled: false,
    decay: 1.8,
    preDelay: 0.02,
    mix: 0.25,
  },
  delay: {
    enabled: false,
    time: 0.25, // 1/4 note or 250ms
    feedback: 0.35,
    mix: 0.2,
  },
  saturation: {
    enabled: false,
    drive: 0.3,
    tone: 0.5,
    mix: 0.3,
  },
};

export const DEFAULT_FX_RACK_STATE: FxRackState = {
  vocals: {
    ...DEFAULT_STEM_FX,
    reverb: { enabled: true, decay: 2.2, preDelay: 0.03, mix: 0.2 },
    compressor: { enabled: true, threshold: -16, ratio: 3.5, attack: 0.015, release: 0.2, knee: 12 },
  },
  drums: {
    ...DEFAULT_STEM_FX,
    compressor: { enabled: true, threshold: -12, ratio: 6, attack: 0.005, release: 0.1, knee: 6 },
    saturation: { enabled: true, drive: 0.4, tone: 0.6, mix: 0.35 },
  },
  bass: {
    ...DEFAULT_STEM_FX,
    saturation: { enabled: true, drive: 0.45, tone: 0.3, mix: 0.4 },
    compressor: { enabled: true, threshold: -14, ratio: 5, attack: 0.02, release: 0.2, knee: 8 },
  },
  other: {
    ...DEFAULT_STEM_FX,
    delay: { enabled: true, time: 0.35, feedback: 0.3, mix: 0.2 },
    reverb: { enabled: true, decay: 2.5, preDelay: 0.02, mix: 0.25 },
  },
};

// ---------------- AUTOMATION TYPES ----------------

export interface AutomationPoint {
  id: string;
  time: number; // in seconds
  target: string; // e.g. 'vocals.volume', 'master.djFilterCutoff', 'drums.pan'
  value: number; // 0.0 to 1.0 or actual Hz
}

export interface AutomationLane {
  target: string;
  name: string;
  color: string;
  min: number;
  max: number;
  points: AutomationPoint[];
  isArmed: boolean;
  isEnabled: boolean;
}

// ---------------- PERFORMANCE CAPTURE TYPES ----------------

export interface PerformanceCaptureEvent {
  time: number; // timeline time in seconds
  type: 'gesture' | 'fader' | 'filter' | 'scene' | 'fx';
  data: Record<string, unknown>;
}

export interface PerformanceSession {
  id: string;
  title: string;
  timestamp: string;
  duration: number;
  totalGestures: number;
  totalAutomationPoints: number;
  scenesTriggered: string[];
  events: PerformanceCaptureEvent[];
  projectSnapshot: MusicOutsProject;
}

// ---------------- MULTI-SONG & AUDIO CLIP TYPES ----------------

export interface AudioClip {
  id: string;
  songId: string;
  songTitle: string;
  stem: StemType;
  startTime: number; // timeline start position in seconds
  sourceOffset: number; // offset into source AudioBuffer in seconds
  duration: number; // length of this slice in seconds
  gain: number; // 0.0 to 2.0 (volume multiplier)
  muted: boolean;
  name: string;
  color?: string;
}

export interface SongItem {
  id: string;
  title: string;
  duration: number;
  stems: Record<StemType, string>;
  color: string;
  bpm?: number;
  key?: string;
}

// ---------------- FULL PROJECT FILE FORMAT ----------------

export interface MusicOutsProject {
  version: string;
  title: string;
  trackId: string;
  duration: number;
  bpm: number;
  key: string;
  timeSignature: string;
  mode: StudioMode;
  stemStates: Record<StemType, StemState>;
  fxRack: FxRackState;
  masterVolume: number;
  djFilterCutoff: number;
  djFilterType: 'lowpass' | 'highpass';
  isDucking: boolean;
  markers: TimelineMarker[];
  automation: AutomationPoint[];
  songs?: SongItem[];
  clips?: AudioClip[];
  scenes?: Array<{
    id: string;
    name: string;
    description: string;
    stems: Record<StemType, StemState>;
    filterCutoff: number;
    filterType: 'lowpass' | 'highpass';
  }>;
  created: string;
}
