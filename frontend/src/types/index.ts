/**
 * Core type definitions for MusicOuts Gesture Music Stem Mixer
 */

export type StemType = 'vocals' | 'drums' | 'bass' | 'other';

export const STEM_TYPES: StemType[] = ['vocals', 'drums', 'bass', 'other'];

export type StudioView = 'arrangement' | 'mixer' | 'gesture' | 'visualizer' | 'ingestion';

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

export interface MusicOutsProject {
  version: string;
  title: string;
  trackId: string;
  duration: number;
  bpm: number;
  key: string;
  stemStates: Record<StemType, StemState>;
  masterVolume: number;
  djFilterCutoff: number;
  djFilterType: 'lowpass' | 'highpass';
  isDucking: boolean;
  markers: TimelineMarker[];
  created: string;
}
