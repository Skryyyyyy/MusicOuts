/**
 * MusicOuts Project Model Types
 * Non-destructive Edit Decision List (EDL) Architecture
 */

export type CurveType = 'linear' | 'hold' | 'bezier' | 'ease';

export interface KeyframePoint {
  id: string;
  time: number; // in seconds relative to parent (clip or track timeline)
  value: number; // normalized or parameter unit
  curve: CurveType;
  // Control points for cubic bezier curves (x: 0..1, y: 0..1)
  controlPointIn?: { x: number; y: number };
  controlPointOut?: { x: number; y: number };
}

export interface KeyframeLane {
  id: string;
  parameter: 'volume' | 'pan' | 'eq_low' | 'eq_mid' | 'eq_high' | 'reverb_send' | 'filter_cutoff' | 'pitch_cents';
  displayName: string;
  color: string;
  defaultValue: number;
  minValue: number;
  maxValue: number;
  unit: string;
  points: KeyframePoint[];
}

export interface Fade {
  duration: number; // seconds
  curve: 'linear' | 'exponential' | 's-curve';
}

export interface Clip {
  id: string;
  name: string;
  trackId: string;
  sourceId: string; // References immutable SourceAsset
  sourceIn: number; // Seconds into source asset
  sourceOut: number; // Seconds into source asset
  startTime: number; // Timeline placement in seconds
  gain: number; // Linear gain multiplier (default 1.0)
  pan: number; // -1.0 (Left) to 1.0 (Right)
  fadeIn?: Fade;
  fadeOut?: Fade;
  isMuted: boolean;
  color?: string;
  automationLanes: KeyframeLane[];
}

export type StemType = 'mix' | 'vocals' | 'drums' | 'bass' | 'other' | 'guitar' | 'piano' | 'kick' | 'snare' | 'hats';

export interface SourceAsset {
  id: string; // Content hash or unique identifier
  name: string;
  duration: number; // in seconds
  sampleRate: number;
  channels: number;
  fileSize: number;
  bpm?: number;
  key?: string;
  stemType?: StemType;
  parentSourceId?: string; // If split from a parent asset
  // Multi-resolution peak pyramid levels (e.g. 256, 1024, 4096 samples per bin)
  peakPyramids?: {
    [resolution: number]: { min: Float32Array; max: Float32Array };
  };
  audioBuffer?: AudioBuffer;
}

export interface SongSection {
  id: string;
  name: 'Intro' | 'Verse' | 'Chorus' | 'Drop' | 'Bridge' | 'Outro' | string;
  startTime: number;
  endTime: number;
  color: string;
}

export interface Track {
  id: string;
  name: string;
  stemType: StemType;
  color: string;
  volume: number; // 0.0 to 2.0 (1.0 = 0dB)
  pan: number; // -1.0 to 1.0
  isMuted: boolean;
  isSoloed: boolean;
  eqLowGain: number; // dB (-12 to +12)
  eqMidGain: number; // dB
  eqHighGain: number; // dB
  reverbSend: number; // 0.0 to 1.0
  automationLanes: KeyframeLane[];
}

export interface Marker {
  id: string;
  time: number;
  name: string;
  color: string;
}

export interface Project {
  schemaVersion: number;
  id: string;
  name: string;
  bpm: number;
  timeSignature: [number, number]; // e.g. [4, 4]
  sampleRate: number;
  duration: number; // Overall timeline duration in seconds
  sources: Record<string, SourceAsset>;
  tracks: Track[];
  clips: Clip[];
  markers: Marker[];
  sections: SongSection[];
  masterVolume: number;
  masterLimiterCeiling: number; // dB (e.g. -0.1 dB)
  createdAt: string;
  updatedAt: string;
}
