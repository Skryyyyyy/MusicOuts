/**
 * Stem Lab Definitions & Pipeline Types
 * Demucs v4 (htdemucs 4-stem and 6-stem variant) + Drum sub-splitters
 */

export type SeparationModelType = 'htdemucs_4s' | 'htdemucs_6s' | 'drum_subsplit';

export interface StemJob {
  id: string;
  sourceAssetId: string;
  model: SeparationModelType;
  quality: 'fast' | 'balanced' | 'high_quality';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0.0 to 1.0
  error?: string;
  stemAssets: {
    vocals?: string;
    drums?: string;
    bass?: string;
    other?: string;
    guitar?: string;
    piano?: string;
    kick?: string;
    snare?: string;
    hats?: string;
  };
  createdAt: number;
}

export interface StemLabService {
  requestSeparation(assetId: string, model: SeparationModelType): Promise<StemJob>;
  getJobStatus(jobId: string): StemJob | undefined;
  cancelJob(jobId: string): void;
}
