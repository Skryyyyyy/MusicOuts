import {
  STEM_TYPES,
  StemState,
  StemType,
  StemFxState,
  StemEqConfig,
  StemCompConfig,
  StemReverbConfig,
  StemDelayConfig,
  StemSaturationConfig,
  DEFAULT_FX_RACK_STATE,
  FxRackState,
  AudioClip,
  ReverbPresetType,
} from '../types';

export const DEFAULT_RAMP_DURATION = 0.03; // 30ms click-free ramp
export const MIN_FILTER_FREQ = 20;
export const MAX_FILTER_FREQ = 20000;
export const DEFAULT_FFT_SIZE = 1024;

/**
 * Generate a sigmoid waveshaper distortion curve
 */
export function makeDistortionCurve(drive: number = 0.5, n_samples: number = 44100): Float32Array {
  const k = Math.max(0, Math.min(1.0, drive)) * 50;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    if (k === 0) {
      curve[i] = x;
    } else {
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
  }
  return curve;
}

/**
 * Reverses an AudioBuffer sample-by-sample with pristine fidelity
 */
export function reverseAudioBuffer(audioCtx: AudioContext, buffer: AudioBuffer): AudioBuffer {
  const numChannels = buffer.numberOfChannels;
  const reversed = audioCtx.createBuffer(numChannels, buffer.length, buffer.sampleRate);
  for (let c = 0; c < numChannels; c++) {
    const src = buffer.getChannelData(c);
    const dest = reversed.getChannelData(c);
    const len = src.length;
    for (let i = 0; i < len; i++) {
      dest[i] = src[len - 1 - i];
    }
  }
  return reversed;
}

/**
 * Synthesizes a high-definition algorithmic impulse response buffer for convolution reverb
 * Supporting presets: 'hall', 'room', 'plate', 'reverse' (swell), 'cathedral'
 */
export function buildImpulseResponse(
  audioCtx: AudioContext,
  duration: number = 2.0,
  decay: number = 2.0,
  preset: ReverbPresetType = 'hall'
): AudioBuffer {
  const sampleRate = audioCtx.sampleRate || 44100;
  const dur = Math.max(0.2, Math.min(8.0, duration));
  const length = Math.max(1, Math.floor(sampleRate * dur));
  const impulse = audioCtx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  const stereoPhaseOffset = Math.floor(sampleRate * 0.012); // 12ms decorrelation

  if (preset === 'reverse') {
    // Reverse Reverb (psychedelic swelling crescendo into the beat)
    for (let i = 0; i < length; i++) {
      const n = i / length;
      const env = Math.pow(n, decay * 1.3);
      left[i] = (Math.random() * 2 - 1) * env;
      right[i] = (Math.random() * 2 - 1) * env;
    }
  } else if (preset === 'room') {
    // Tight acoustic room with discrete early reflections & warm diffusion
    const earlyTimes = [0.008, 0.015, 0.024, 0.035, 0.048].map((t) => Math.floor(t * sampleRate));
    const earlyGains = [0.8, 0.65, 0.5, 0.35, 0.2];
    for (let i = 0; i < length; i++) {
      const n = i / length;
      const env = Math.exp(-decay * 2.8 * n);
      let valL = (Math.random() * 2 - 1) * env * 0.6;
      let valR = (Math.random() * 2 - 1) * env * 0.6;
      for (let k = 0; k < earlyTimes.length; k++) {
        if (i === earlyTimes[k]) {
          valL += earlyGains[k];
          valR += earlyGains[k] * 0.9;
        }
      }
      left[i] = valL;
      right[i] = valR;
    }
  } else if (preset === 'plate') {
    // Plate: dense, bright, fast buildup with metallic shimmering diffusion
    for (let i = 0; i < length; i++) {
      const n = i / length;
      const env = Math.exp(-decay * 1.8 * n);
      const diffL = Math.sin(i * 0.18) * 0.25 + (Math.random() * 2 - 1) * 0.75;
      const diffR = Math.cos(i * 0.18) * 0.25 + (Math.random() * 2 - 1) * 0.75;
      left[i] = diffL * env;
      right[i] = diffR * env;
    }
  } else if (preset === 'cathedral') {
    // Cathedral: expansive sacred hall with huge shimmering tail
    for (let i = 0; i < length; i++) {
      const n = i / length;
      const env = Math.pow(1 - n, decay * 0.8);
      const shimmer = 1 + 0.15 * Math.sin(2 * Math.PI * 3.5 * (i / sampleRate));
      left[i] = (Math.random() * 2 - 1) * env * shimmer;
      right[i] = (Math.random() * 2 - 1) * env * shimmer;
    }
  } else {
    // Hall (Default): deep, rich reverberation with natural stereo space
    for (let i = 0; i < length; i++) {
      const n = i / length;
      const env = Math.pow(1 - n, decay * 1.3);
      const lSample = (Math.random() * 2 - 1) * env;
      const rIdx = (i + stereoPhaseOffset) % length;
      const rEnv = Math.pow(1 - rIdx / length, decay * 1.3);
      const rSample = (Math.random() * 2 - 1) * rEnv;
      left[i] = lSample;
      right[i] = rSample;
    }
  }

  return impulse;
}

export interface StemChannel {
  type: StemType;
  buffer: AudioBuffer | null;
  sourceNode: AudioBufferSourceNode | null;
  
  // FX Insert DSP Nodes
  inputNode: GainNode;
  eqLowNode: BiquadFilterNode;
  eqMidNode: BiquadFilterNode;
  eqHighNode: BiquadFilterNode;
  
  // Saturation
  saturationNode: WaveShaperNode;
  saturationDryGain: GainNode;
  saturationWetGain: GainNode;
  saturationOutGain: GainNode;

  // Compressor
  compressorNode: DynamicsCompressorNode;
  compressorDryGain: GainNode;
  compressorWetGain: GainNode;
  compressorOutGain: GainNode;

  // Delay
  delayNode: DelayNode;
  delayFeedbackGain: GainNode;
  delayDryGain: GainNode;
  delayWetGain: GainNode;
  delayOutGain: GainNode;

  // Reverb
  reverbNode: ConvolverNode;
  reverbDryGain: GainNode;
  reverbWetGain: GainNode;
  reverbOutGain: GainNode;

  pannerNode: StereoPannerNode | null;
  gainNode: GainNode;
  analyserNode: AnalyserNode;
  state: StemState;
  fxState: StemFxState;
}

export interface DjFilterState {
  cutoff: number;
  type: BiquadFilterType;
  Q: number;
}

export class AudioGraphEngine {
  private audioContext: AudioContext;
  private isExternalContext: boolean;
  private channels: Record<StemType, StemChannel>;
  
  // Master DSP chain
  private masterFilterNode: BiquadFilterNode;
  private masterGainNode: GainNode;
  private masterAnalyserNode: AnalyserNode;

  // Playback timeline state
  private isPlayingState: boolean = false;
  private isLooping: boolean = false;
  private startTime: number = 0;
  private startOffset: number = 0;
  private pausedOffset: number = 0;
  private duration: number = 0;

  // Filter and Master volume state
  private masterVolume: number = 1.0;
  private djFilterState: DjFilterState = {
    cutoff: MAX_FILTER_FREQ,
    type: 'lowpass',
    Q: 1.0,
  };

  // Auto Sidechain Ducking State
  private isDuckingEnabledState: boolean = false;
  private duckingAmount: number = 0.35; // Backing stems gain multiplier when vocals active (-9dB)
  private duckingThreshold: number = 0.045; // RMS threshold on vocal channel
  private currentDuckingGainReduction: number = 1.0;

  // Peak overview cache for timeline waveform rendering
  private peakCache: WeakMap<AudioBuffer, Float32Array> = new WeakMap();

  // Reusable typed array buffers for visualizers to prevent GC pressure
  private freqBuffers: WeakMap<AnalyserNode, Uint8Array> = new WeakMap();
  private waveBuffers: WeakMap<AnalyserNode, Uint8Array> = new WeakMap();

  // Multi-Song Buffer Cache & Clip Arrange Timeline
  private songBuffers: Map<string, Record<StemType, AudioBuffer>> = new Map();
  private clips: AudioClip[] = [];
  private clipSourceNodes: AudioBufferSourceNode[] = [];

  // Per-Stem Independent Timeline Offsets (Vocals, Drums, Bass, Other)
  private stemOffsets: Record<StemType, number> = {
    vocals: 0,
    drums: 0,
    bass: 0,
    other: 0,
  };

  // Audio Buffer Reversal Engine State
  private isStemReversedMap: Record<StemType, boolean> = {
    vocals: false,
    drums: false,
    bass: false,
    other: false,
  };
  private originalStemBuffers: Record<StemType, AudioBuffer | null> = {
    vocals: null,
    drums: null,
    bass: null,
    other: null,
  };
  private reversedStemBuffers: Record<StemType, AudioBuffer | null> = {
    vocals: null,
    drums: null,
    bass: null,
    other: null,
  };

  // Callbacks
  private endedCallbacks: Set<() => void> = new Set();

  constructor(audioContext?: AudioContext) {
    if (audioContext) {
      this.audioContext = audioContext;
      this.isExternalContext = true;
    } else {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtxClass();
      this.isExternalContext = false;
    }

    // 1. Initialize Master DSP chain
    this.masterFilterNode = this.audioContext.createBiquadFilter();
    this.masterFilterNode.type = 'lowpass';
    this.masterFilterNode.frequency.setValueAtTime(
      MAX_FILTER_FREQ,
      this.audioContext.currentTime
    );
    this.masterFilterNode.Q.setValueAtTime(1.0, this.audioContext.currentTime);

    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);

    this.masterAnalyserNode = this.audioContext.createAnalyser();
    this.masterAnalyserNode.fftSize = DEFAULT_FFT_SIZE;
    this.masterAnalyserNode.smoothingTimeConstant = 0.8;
    this.masterAnalyserNode.minDecibels = -90;
    this.masterAnalyserNode.maxDecibels = -10;

    // Connect master chain: Master Filter -> Master Gain -> Master Analyser -> Destination
    this.masterFilterNode.connect(this.masterGainNode);
    this.masterGainNode.connect(this.masterAnalyserNode);
    this.masterAnalyserNode.connect(this.audioContext.destination);

    // 2. Initialize Channels & FX Racks for 4 stems
    this.channels = {} as Record<StemType, StemChannel>;

    for (const stem of STEM_TYPES) {
      const initialFx = JSON.parse(JSON.stringify(DEFAULT_FX_RACK_STATE[stem])) as StemFxState;

      // Channel input routing
      const inputNode = this.audioContext.createGain();

      // 3-Band EQ Nodes
      const eqLowNode = this.audioContext.createBiquadFilter();
      eqLowNode.type = 'lowshelf';
      eqLowNode.frequency.setValueAtTime(initialFx.eq.lowFreq, this.audioContext.currentTime);
      eqLowNode.gain.setValueAtTime(initialFx.eq.enabled ? initialFx.eq.lowGain : 0, this.audioContext.currentTime);

      const eqMidNode = this.audioContext.createBiquadFilter();
      eqMidNode.type = 'peaking';
      eqMidNode.frequency.setValueAtTime(initialFx.eq.midFreq, this.audioContext.currentTime);
      eqMidNode.Q.setValueAtTime(1.0, this.audioContext.currentTime);
      eqMidNode.gain.setValueAtTime(initialFx.eq.enabled ? initialFx.eq.midGain : 0, this.audioContext.currentTime);

      const eqHighNode = this.audioContext.createBiquadFilter();
      eqHighNode.type = 'highshelf';
      eqHighNode.frequency.setValueAtTime(initialFx.eq.highFreq, this.audioContext.currentTime);
      eqHighNode.gain.setValueAtTime(initialFx.eq.enabled ? initialFx.eq.highGain : 0, this.audioContext.currentTime);

      // Saturation Stage
      const saturationNode = this.audioContext.createWaveShaper();
      saturationNode.curve = makeDistortionCurve(initialFx.saturation.drive) as unknown as Float32Array<ArrayBuffer>;
      saturationNode.oversample = '2x';

      const saturationDryGain = this.audioContext.createGain();
      const saturationWetGain = this.audioContext.createGain();
      const saturationOutGain = this.audioContext.createGain();

      const satMix = initialFx.saturation.enabled ? initialFx.saturation.mix : 0;
      saturationDryGain.gain.setValueAtTime(1 - satMix, this.audioContext.currentTime);
      saturationWetGain.gain.setValueAtTime(satMix, this.audioContext.currentTime);

      // Compressor Stage
      const compressorNode = this.audioContext.createDynamicsCompressor();
      compressorNode.threshold.setValueAtTime(initialFx.compressor.threshold, this.audioContext.currentTime);
      compressorNode.ratio.setValueAtTime(initialFx.compressor.ratio, this.audioContext.currentTime);
      compressorNode.attack.setValueAtTime(initialFx.compressor.attack, this.audioContext.currentTime);
      compressorNode.release.setValueAtTime(initialFx.compressor.release, this.audioContext.currentTime);
      compressorNode.knee.setValueAtTime(initialFx.compressor.knee, this.audioContext.currentTime);

      const compressorDryGain = this.audioContext.createGain();
      const compressorWetGain = this.audioContext.createGain();
      const compressorOutGain = this.audioContext.createGain();

      compressorDryGain.gain.setValueAtTime(initialFx.compressor.enabled ? 0 : 1, this.audioContext.currentTime);
      compressorWetGain.gain.setValueAtTime(initialFx.compressor.enabled ? 1 : 0, this.audioContext.currentTime);

      // Delay Stage
      const delayNode = this.audioContext.createDelay(2.0);
      delayNode.delayTime.setValueAtTime(initialFx.delay.time, this.audioContext.currentTime);

      const delayFeedbackGain = this.audioContext.createGain();
      delayFeedbackGain.gain.setValueAtTime(initialFx.delay.feedback, this.audioContext.currentTime);

      const delayDryGain = this.audioContext.createGain();
      const delayWetGain = this.audioContext.createGain();
      const delayOutGain = this.audioContext.createGain();

      const delayMix = initialFx.delay.enabled ? initialFx.delay.mix : 0;
      delayDryGain.gain.setValueAtTime(1.0, this.audioContext.currentTime);
      delayWetGain.gain.setValueAtTime(delayMix, this.audioContext.currentTime);

      // Reverb Stage
      const reverbNode = this.audioContext.createConvolver();
      reverbNode.buffer = buildImpulseResponse(this.audioContext, initialFx.reverb.decay);

      const reverbDryGain = this.audioContext.createGain();
      const reverbWetGain = this.audioContext.createGain();
      const reverbOutGain = this.audioContext.createGain();

      const revMix = initialFx.reverb.enabled ? initialFx.reverb.mix : 0;
      reverbDryGain.gain.setValueAtTime(1.0 - revMix * 0.4, this.audioContext.currentTime);
      reverbWetGain.gain.setValueAtTime(revMix, this.audioContext.currentTime);

      // Channel Gain & Pan
      const gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);

      let pannerNode: StereoPannerNode | null = null;
      if (typeof this.audioContext.createStereoPanner === 'function') {
        pannerNode = this.audioContext.createStereoPanner();
        pannerNode.pan.setValueAtTime(0.0, this.audioContext.currentTime);
      }

      const analyserNode = this.audioContext.createAnalyser();
      analyserNode.fftSize = DEFAULT_FFT_SIZE;
      analyserNode.smoothingTimeConstant = 0.8;
      analyserNode.minDecibels = -90;
      analyserNode.maxDecibels = -10;

      // Connect DSP chain:
      // inputNode -> eqLow -> eqMid -> eqHigh
      inputNode.connect(eqLowNode);
      eqLowNode.connect(eqMidNode);
      eqMidNode.connect(eqHighNode);

      // eqHigh -> Saturation (dry & wet) -> saturationOut
      eqHighNode.connect(saturationDryGain);
      saturationDryGain.connect(saturationOutGain);
      eqHighNode.connect(saturationNode);
      saturationNode.connect(saturationWetGain);
      saturationWetGain.connect(saturationOutGain);

      // saturationOut -> Compressor (dry & wet) -> compressorOut
      saturationOutGain.connect(compressorDryGain);
      compressorDryGain.connect(compressorOutGain);
      saturationOutGain.connect(compressorNode);
      compressorNode.connect(compressorWetGain);
      compressorWetGain.connect(compressorOutGain);

      // compressorOut -> Delay (dry & wet) -> delayOut
      compressorOutGain.connect(delayDryGain);
      delayDryGain.connect(delayOutGain);
      compressorOutGain.connect(delayNode);
      delayNode.connect(delayFeedbackGain);
      delayFeedbackGain.connect(delayNode); // feedback loop
      delayNode.connect(delayWetGain);
      delayWetGain.connect(delayOutGain);

      // delayOut -> Reverb (dry & wet) -> reverbOut
      delayOutGain.connect(reverbDryGain);
      reverbDryGain.connect(reverbOutGain);
      delayOutGain.connect(reverbNode);
      reverbNode.connect(reverbWetGain);
      reverbWetGain.connect(reverbOutGain);

      // reverbOut -> Panner -> Gain -> Analyser -> Master Filter
      if (pannerNode) {
        reverbOutGain.connect(pannerNode);
        pannerNode.connect(gainNode);
      } else {
        reverbOutGain.connect(gainNode);
      }
      gainNode.connect(analyserNode);
      analyserNode.connect(this.masterFilterNode);

      this.channels[stem] = {
        type: stem,
        buffer: null,
        sourceNode: null,
        inputNode,
        eqLowNode,
        eqMidNode,
        eqHighNode,
        saturationNode,
        saturationDryGain,
        saturationWetGain,
        saturationOutGain,
        compressorNode,
        compressorDryGain,
        compressorWetGain,
        compressorOutGain,
        delayNode,
        delayFeedbackGain,
        delayDryGain,
        delayWetGain,
        delayOutGain,
        reverbNode,
        reverbDryGain,
        reverbWetGain,
        reverbOutGain,
        pannerNode,
        gainNode,
        analyserNode,
        state: {
          volume: 1.0,
          muted: false,
          solo: false,
          pan: 0.0,
        },
        fxState: initialFx,
      };
    }
  }

  /**
   * Loads stem audio files from provided URLs or track ID mappings.
   */
  public async loadStems(
    trackIdOrStems: string | Record<StemType, string>,
    stemsMap?: Record<StemType, string>
  ): Promise<void> {
    let resolvedUrls: Record<StemType, string>;

    if (typeof trackIdOrStems === 'string') {
      const trackId = trackIdOrStems;
      if (stemsMap) {
        resolvedUrls = { ...stemsMap };
        for (const stem of STEM_TYPES) {
          const val = resolvedUrls[stem];
          if (val && !val.startsWith('http://') && !val.startsWith('https://') && !val.startsWith('/')) {
            resolvedUrls[stem] = `/api/media/${trackId}/${val}`;
          }
        }
      } else {
        resolvedUrls = {
          vocals: `/api/media/${trackId}/vocals`,
          drums: `/api/media/${trackId}/drums`,
          bass: `/api/media/${trackId}/bass`,
          other: `/api/media/${trackId}/other`,
        };
      }
    } else {
      resolvedUrls = trackIdOrStems;
    }

    // Fetch and decode concurrently
    const loadPromises = STEM_TYPES.map(async (stem) => {
      const url = resolvedUrls[stem];
      if (!url) {
        this.channels[stem].buffer = null;
        return;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch stem ${stem} from ${url}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await this.decodeAudio(arrayBuffer);
      this.channels[stem].buffer = decodedBuffer;
      this.originalStemBuffers[stem] = decodedBuffer;
      this.reversedStemBuffers[stem] = null;
      this.isStemReversedMap[stem] = false;
    });

    await Promise.all(loadPromises);

    // Cache loaded song buffers
    const songId = typeof trackIdOrStems === 'string' ? trackIdOrStems : 'default_track';
    const trackBuffers = {} as Record<StemType, AudioBuffer>;
    for (const stem of STEM_TYPES) {
      if (this.channels[stem].buffer) {
        trackBuffers[stem] = this.channels[stem].buffer!;
      }
    }
    this.songBuffers.set(songId, trackBuffers);

    // Calculate maximum duration across loaded stems
    let maxDuration = 0;
    for (const stem of STEM_TYPES) {
      if (this.channels[stem].buffer) {
        maxDuration = Math.max(maxDuration, this.channels[stem].buffer!.duration);
      }
    }

    this.duration = maxDuration;
    this.pausedOffset = 0;
    this.startOffset = 0;
  }

  /**
   * Loads and caches stems for an individual song in the project media pool
   */
  public async loadSongStems(
    songId: string,
    urls: Record<StemType, string>
  ): Promise<Record<StemType, AudioBuffer>> {
    const loadedBuffers = {} as Record<StemType, AudioBuffer>;

    const loadPromises = STEM_TYPES.map(async (stem) => {
      const url = urls[stem];
      if (!url) return;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch song ${songId} stem ${stem}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const decoded = await this.decodeAudio(arrayBuffer);
      loadedBuffers[stem] = decoded;
    });

    await Promise.all(loadPromises);
    this.songBuffers.set(songId, loadedBuffers);

    let maxDuration = this.duration;
    for (const stem of STEM_TYPES) {
      if (loadedBuffers[stem]) {
        maxDuration = Math.max(maxDuration, loadedBuffers[stem].duration);
      }
    }
    if (maxDuration > 0) {
      this.duration = maxDuration;
    }

    return loadedBuffers;
  }

  /**
   * Decode ArrayBuffer into AudioBuffer with cross-browser fallback
   */
  private decodeAudio(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      const bufferCopy = arrayBuffer.slice(0);
      const res = this.audioContext.decodeAudioData(
        bufferCopy,
        (decoded) => resolve(decoded),
        (err) => reject(err)
      );
      if (res && typeof (res as unknown as Promise<AudioBuffer>).then === 'function') {
        (res as unknown as Promise<AudioBuffer>).then(resolve).catch(reject);
      }
    });
  }

  /**
   * Starts synchronized playback of scheduled clips or full stems.
   */
  public async play(offsetSeconds?: number): Promise<void> {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.stopActiveSources();

    const targetOffset = offsetSeconds !== undefined ? offsetSeconds : this.pausedOffset;
    const clampedOffset = Math.max(0, Math.min(targetOffset, this.duration));

    const now = this.audioContext.currentTime;
    this.startTime = now;
    this.startOffset = clampedOffset;
    this.pausedOffset = clampedOffset;
    this.isPlayingState = true;

    if (this.clips.length > 0) {
      // Schedule Audio Clips on Timeline
      let maxEnd = this.duration;
      let activeCount = 0;

      for (const clip of this.clips) {
        if (clip.muted) continue;

        let buffer: AudioBuffer | null = null;
        if (clip.songId && this.songBuffers.has(clip.songId)) {
          buffer = this.songBuffers.get(clip.songId)![clip.stem] || null;
        }
        if (!buffer) {
          buffer = this.channels[clip.stem]?.buffer;
        }
        if (!buffer) continue;

        if (clip.isReversed) {
          buffer = reverseAudioBuffer(this.audioContext, buffer);
        }

        const effectiveClipDuration = clip.duration > 0 ? clip.duration : buffer.duration;
        const clipEnd = clip.startTime + effectiveClipDuration;
        maxEnd = Math.max(maxEnd, clipEnd);
        if (clampedOffset >= clipEnd) continue;

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.channels[clip.stem].inputNode);

        const startDelay = Math.max(0, clip.startTime - clampedOffset);
        const sourceOffset = clip.sourceOffset + Math.max(0, clampedOffset - clip.startTime);
        const remainingClipTime = effectiveClipDuration - Math.max(0, clampedOffset - clip.startTime);
        const playDuration = Math.min(Math.max(0, buffer.duration - sourceOffset), remainingClipTime);

        if (playDuration > 0) {
          activeCount++;
          source.onended = () => {
            const idx = this.clipSourceNodes.indexOf(source);
            if (idx !== -1) {
              this.clipSourceNodes.splice(idx, 1);
            }
            if (this.clipSourceNodes.length === 0 && this.isPlayingState) {
              if (this.isLooping) {
                this.play(0);
              } else {
                this.isPlayingState = false;
                this.pausedOffset = this.duration;
                this.emitEnded();
              }
            }
          };

          source.start(now + startDelay, sourceOffset, playDuration);
          this.clipSourceNodes.push(source);
        }
      }

      if (maxEnd > 0) {
        this.duration = Math.max(this.duration, maxEnd);
      }

      if (activeCount === 0 && clampedOffset >= this.duration) {
        if (this.isLooping) {
          this.play(0);
        } else {
          this.isPlayingState = false;
          this.pausedOffset = this.duration;
          this.emitEnded();
        }
      }
    } else {
      // Fallback: Full 4-stem channel playback
      for (const stem of STEM_TYPES) {
        const channel = this.channels[stem];
        if (!channel.buffer) continue;

        const source = this.audioContext.createBufferSource();
        source.buffer = channel.buffer;
        source.loop = this.isLooping;

        source.connect(channel.inputNode);

        source.onended = () => {
          if (channel.sourceNode === source) {
            channel.sourceNode = null;
            const allStopped = STEM_TYPES.every((s) => !this.channels[s].sourceNode);
            if (allStopped && this.isPlayingState) {
              this.isPlayingState = false;
              this.pausedOffset = this.isLooping ? 0 : this.duration;
              this.emitEnded();
            }
          }
        };

        const stemOffset = Math.max(
          0,
          Math.min(this.duration, clampedOffset + (this.stemOffsets[stem] || 0))
        );

        source.start(now, stemOffset);
        channel.sourceNode = source;
      }
    }
  }

  /**
   * Pauses playback while maintaining exact timeline position.
   */
  public pause(): void {
    if (!this.isPlayingState) return;

    this.pausedOffset = this.getCurrentTime();
    this.stopActiveSources();
    this.isPlayingState = false;
  }

  /**
   * Seeks the global timeline to a specific timestamp in seconds.
   */
  public seek(seconds: number): void {
    const target = Math.max(0, Math.min(seconds, this.duration));
    if (this.isPlayingState) {
      this.play(target);
    } else {
      this.pausedOffset = target;
      this.startOffset = target;
    }
  }

  /**
   * Seeks ONLY a single stem track independently without moving or disturbing any other stem.
   */
  public seekStem(stem: StemType, targetSeconds: number): void {
    const clamped = Math.max(0, Math.min(targetSeconds, this.duration));
    const baseTime = this.isPlayingState
      ? this.startOffset + (this.audioContext.currentTime - this.startTime)
      : this.pausedOffset;

    this.stemOffsets[stem] = clamped - baseTime;

    if (this.isPlayingState) {
      const channel = this.channels[stem];
      if (channel.sourceNode) {
        try {
          channel.sourceNode.stop();
          channel.sourceNode.disconnect();
        } catch {
          // Ignore
        }
        channel.sourceNode = null;
      }

      if (channel.buffer) {
        const now = this.audioContext.currentTime;
        const source = this.audioContext.createBufferSource();
        source.buffer = channel.buffer;
        source.loop = this.isLooping;
        source.connect(channel.inputNode);

        source.onended = () => {
          if (channel.sourceNode === source) {
            channel.sourceNode = null;
          }
        };

        source.start(now, clamped);
        channel.sourceNode = source;
      }
    }
  }

  /**
   * Gets the exact current playback position of a specific stem (seconds).
   */
  public getStemTime(stem: StemType): number {
    const baseTime = this.isPlayingState
      ? this.startOffset + (this.audioContext.currentTime - this.startTime)
      : this.pausedOffset;
    const stemTime = baseTime + (this.stemOffsets[stem] || 0);
    if (this.duration <= 0) return 0;
    if (this.isLooping) {
      return ((stemTime % this.duration) + this.duration) % this.duration;
    }
    return Math.max(0, Math.min(this.duration, stemTime));
  }

  /**
   * Gets a snapshot of current playback timestamps for all 4 stems.
   */
  public getStemTimes(): Record<StemType, number> {
    return {
      vocals: this.getStemTime('vocals'),
      drums: this.getStemTime('drums'),
      bass: this.getStemTime('bass'),
      other: this.getStemTime('other'),
    };
  }

  /**
   * Resets all per-stem offsets back to zero (re-aligns all playheads).
   */
  public resetStemOffsets(): void {
    this.stemOffsets = { vocals: 0, drums: 0, bass: 0, other: 0 };
    if (this.isPlayingState) {
      this.play(this.getCurrentTime());
    }
  }

  /**
   * Returns current per-stem offset values in seconds.
   */
  public getStemOffsets(): Record<StemType, number> {
    return { ...this.stemOffsets };
  }

  // ---------------- STEM & CLIP REVERSE METHODS ----------------

  /**
   * Toggles reverse playback on or off for an individual stem.
   * If playing, hot-restarts the stem playback with the reversed buffer seamlessly.
   */
  public toggleReverseStem(stem: StemType): boolean {
    const channel = this.channels[stem];
    if (!channel) return false;

    const nextReversed = !this.isStemReversedMap[stem];
    this.isStemReversedMap[stem] = nextReversed;

    const orig = this.originalStemBuffers[stem] || channel.buffer;
    if (!orig) return nextReversed;

    if (nextReversed) {
      if (!this.reversedStemBuffers[stem]) {
        this.reversedStemBuffers[stem] = reverseAudioBuffer(this.audioContext, orig);
      }
      channel.buffer = this.reversedStemBuffers[stem];
    } else {
      channel.buffer = orig;
    }

    // Invalidate peak overview cache so reversed waveform will re-render
    if (channel.buffer) {
      this.peakCache.delete(channel.buffer);
    }

    // Hot-restart stem if playing
    if (this.isPlayingState) {
      const currentStemSec = this.getStemTime(stem);
      if (channel.sourceNode) {
        try {
          channel.sourceNode.stop();
          channel.sourceNode.disconnect();
        } catch {
          // Ignore
        }
        channel.sourceNode = null;
      }

      if (channel.buffer) {
        const now = this.audioContext.currentTime;
        const source = this.audioContext.createBufferSource();
        source.buffer = channel.buffer;
        source.loop = this.isLooping;
        source.connect(channel.inputNode);

        source.onended = () => {
          if (channel.sourceNode === source) {
            channel.sourceNode = null;
          }
        };

        source.start(now, currentStemSec);
        channel.sourceNode = source;
      }
    }

    return nextReversed;
  }

  /**
   * Returns true if the given stem is currently playing in reverse.
   */
  public isStemReversed(stem: StemType): boolean {
    return !!this.isStemReversedMap[stem];
  }

  /**
   * Returns a snapshot of reverse states for all 4 stems.
   */
  public getStemReversedStates(): Record<StemType, boolean> {
    return { ...this.isStemReversedMap };
  }

  /**
   * Toggles reverse across all 4 stems simultaneously.
   */
  public reverseAllStems(): boolean {
    const anyNotReversed = STEM_TYPES.some((s) => !this.isStemReversedMap[s]);
    for (const s of STEM_TYPES) {
      if (anyNotReversed !== this.isStemReversedMap[s]) {
        this.toggleReverseStem(s);
      }
    }
    return anyNotReversed;
  }

  /**
   * Toggles reverse playback for an individual audio clip slice.
   */
  public toggleReverseClip(clipId: string): void {
    const clip = this.clips.find((c) => c.id === clipId);
    if (!clip) return;
    clip.isReversed = !clip.isReversed;
    if (this.isPlayingState) {
      this.play(this.getCurrentTime());
    }
  }

  private stopActiveSources(): void {
    // 1. Stop channel sources
    for (const stem of STEM_TYPES) {
      const channel = this.channels[stem];
      if (channel.sourceNode) {
        try {
          channel.sourceNode.stop();
          channel.sourceNode.disconnect();
        } catch {
          // Ignore
        }
        channel.sourceNode = null;
      }
    }

    // 2. Stop clip sources
    for (const source of this.clipSourceNodes) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Ignore
      }
    }
    this.clipSourceNodes = [];
  }

  // ---------------- MULTI-CLIP ARRANGEMENT API ----------------

  public setClips(clips: AudioClip[]): void {
    this.clips = [...clips];
    let maxClipEnd = this.duration;
    for (const c of clips) {
      maxClipEnd = Math.max(maxClipEnd, c.startTime + c.duration);
    }
    this.duration = Math.max(maxClipEnd, 1);
  }

  public getClips(): AudioClip[] {
    return [...this.clips];
  }

  public sliceClip(clipId: string, timelineSeconds: number): AudioClip[] {
    const idx = this.clips.findIndex((c) => c.id === clipId);
    if (idx === -1) return this.clips;

    const clip = this.clips[idx];
    if (timelineSeconds <= clip.startTime || timelineSeconds >= clip.startTime + clip.duration) {
      return this.clips;
    }

    const firstDuration = timelineSeconds - clip.startTime;
    const secondDuration = clip.duration - firstDuration;
    const secondSourceOffset = clip.sourceOffset + firstDuration;

    const clip1: AudioClip = {
      ...clip,
      id: `clip_${Date.now()}_a`,
      duration: firstDuration,
      name: `${clip.name} (Pt 1)`,
    };

    const clip2: AudioClip = {
      ...clip,
      id: `clip_${Date.now()}_b`,
      startTime: timelineSeconds,
      sourceOffset: secondSourceOffset,
      duration: secondDuration,
      name: `${clip.name} (Pt 2)`,
    };

    this.clips.splice(idx, 1, clip1, clip2);
    return [...this.clips];
  }

  public trimClip(clipId: string, newStartOffset: number, newDuration: number): void {
    const clip = this.clips.find((c) => c.id === clipId);
    if (!clip) return;
    clip.sourceOffset = Math.max(0, newStartOffset);
    clip.duration = Math.max(0.1, newDuration);
  }

  public moveClip(clipId: string, newStartTime: number): void {
    const clip = this.clips.find((c) => c.id === clipId);
    if (!clip) return;
    clip.startTime = Math.max(0, newStartTime);
  }

  public duplicateClip(clipId: string): AudioClip | null {
    const clip = this.clips.find((c) => c.id === clipId);
    if (!clip) return null;

    const dup: AudioClip = {
      ...clip,
      id: `clip_${Date.now()}_dup`,
      startTime: clip.startTime + clip.duration,
      name: `${clip.name} (Copy)`,
    };
    this.clips.push(dup);
    return dup;
  }

  public deleteClip(clipId: string): void {
    this.clips = this.clips.filter((c) => c.id !== clipId);
  }

  /**
   * Adjust stem individual volume with smooth anti-click ramping.
   */
  public setStemVolume(
    stem: StemType,
    volume: number,
    rampDuration: number = DEFAULT_RAMP_DURATION
  ): void {
    const channel = this.channels[stem];
    if (!channel) return;

    channel.state.volume = Math.max(0, volume);
    this.applyStemGains(rampDuration);
  }

  public setStemMute(
    stem: StemType,
    muted: boolean,
    rampDuration: number = DEFAULT_RAMP_DURATION
  ): void {
    const channel = this.channels[stem];
    if (!channel) return;

    channel.state.muted = muted;
    this.applyStemGains(rampDuration);
  }

  public setStemSolo(
    stem: StemType,
    solo: boolean,
    rampDuration: number = DEFAULT_RAMP_DURATION
  ): void {
    const channel = this.channels[stem];
    if (!channel) return;

    channel.state.solo = solo;
    this.applyStemGains(rampDuration);
  }

  private applyStemGains(rampDuration: number = DEFAULT_RAMP_DURATION): void {
    const anySolo = STEM_TYPES.some((s) => this.channels[s].state.solo);

    for (const stem of STEM_TYPES) {
      const ch = this.channels[stem];
      let targetGain = 0;

      if (anySolo) {
        if (ch.state.solo && !ch.state.muted) {
          targetGain = ch.state.volume;
        } else {
          targetGain = 0;
        }
      } else {
        if (!ch.state.muted) {
          targetGain = ch.state.volume;
          if (this.isDuckingEnabledState && stem !== 'vocals') {
            targetGain *= this.currentDuckingGainReduction;
          }
        } else {
          targetGain = 0;
        }
      }

      this.rampParam(ch.gainNode.gain, targetGain, rampDuration);
    }
  }

  public setStemPan(
    stem: StemType,
    pan: number,
    rampDuration: number = DEFAULT_RAMP_DURATION
  ): void {
    const channel = this.channels[stem];
    if (!channel) return;

    const clampedPan = Math.max(-1.0, Math.min(1.0, pan));
    channel.state.pan = clampedPan;

    if (channel.pannerNode) {
      this.rampParam(channel.pannerNode.pan, clampedPan, rampDuration);
    }
  }

  // ---------------- FX RACK METHODS ----------------

  public setStemEq(stem: StemType, config: Partial<StemEqConfig>, ramp: number = DEFAULT_RAMP_DURATION): void {
    const ch = this.channels[stem];
    if (!ch) return;
    ch.fxState.eq = { ...ch.fxState.eq, ...config };
    const eq = ch.fxState.eq;

    const lowGain = eq.enabled ? eq.lowGain : 0;
    const midGain = eq.enabled ? eq.midGain : 0;
    const highGain = eq.enabled ? eq.highGain : 0;

    this.rampParam(ch.eqLowNode.gain, lowGain, ramp);
    this.rampParam(ch.eqLowNode.frequency, eq.lowFreq, ramp);
    this.rampParam(ch.eqMidNode.gain, midGain, ramp);
    this.rampParam(ch.eqMidNode.frequency, eq.midFreq, ramp);
    this.rampParam(ch.eqHighNode.gain, highGain, ramp);
    this.rampParam(ch.eqHighNode.frequency, eq.highFreq, ramp);
  }

  public setStemCompressor(stem: StemType, config: Partial<StemCompConfig>, ramp: number = DEFAULT_RAMP_DURATION): void {
    const ch = this.channels[stem];
    if (!ch) return;
    ch.fxState.compressor = { ...ch.fxState.compressor, ...config };
    const comp = ch.fxState.compressor;

    this.rampParam(ch.compressorNode.threshold, comp.threshold, ramp);
    this.rampParam(ch.compressorNode.ratio, comp.ratio, ramp);
    this.rampParam(ch.compressorNode.attack, comp.attack, ramp);
    this.rampParam(ch.compressorNode.release, comp.release, ramp);
    this.rampParam(ch.compressorNode.knee, comp.knee, ramp);

    this.rampParam(ch.compressorDryGain.gain, comp.enabled ? 0 : 1, ramp);
    this.rampParam(ch.compressorWetGain.gain, comp.enabled ? 1 : 0, ramp);
  }

  public setStemSaturation(stem: StemType, config: Partial<StemSaturationConfig>, ramp: number = DEFAULT_RAMP_DURATION): void {
    const ch = this.channels[stem];
    if (!ch) return;
    ch.fxState.saturation = { ...ch.fxState.saturation, ...config };
    const sat = ch.fxState.saturation;

    ch.saturationNode.curve = makeDistortionCurve(sat.drive) as unknown as Float32Array<ArrayBuffer>;
    const mix = sat.enabled ? sat.mix : 0;
    this.rampParam(ch.saturationDryGain.gain, 1.0 - mix, ramp);
    this.rampParam(ch.saturationWetGain.gain, mix, ramp);
  }

  public setStemDelay(stem: StemType, config: Partial<StemDelayConfig>, ramp: number = DEFAULT_RAMP_DURATION): void {
    const ch = this.channels[stem];
    if (!ch) return;
    ch.fxState.delay = { ...ch.fxState.delay, ...config };
    const del = ch.fxState.delay;

    this.rampParam(ch.delayNode.delayTime, del.time, ramp);
    this.rampParam(ch.delayFeedbackGain.gain, del.feedback, ramp);

    const mix = del.enabled ? del.mix : 0;
    this.rampParam(ch.delayDryGain.gain, 1.0, ramp);
    this.rampParam(ch.delayWetGain.gain, mix, ramp);
  }

  public setStemReverb(stem: StemType, config: Partial<StemReverbConfig>, ramp: number = DEFAULT_RAMP_DURATION): void {
    const ch = this.channels[stem];
    if (!ch) return;
    ch.fxState.reverb = { ...ch.fxState.reverb, ...config };
    const rev = ch.fxState.reverb;

    if (config.decay !== undefined || config.preset !== undefined) {
      ch.reverbNode.buffer = buildImpulseResponse(this.audioContext, rev.decay, rev.decay, rev.preset || 'hall');
    }

    const mix = rev.enabled ? rev.mix : 0;
    this.rampParam(ch.reverbDryGain.gain, 1.0 - mix * 0.4, ramp);
    this.rampParam(ch.reverbWetGain.gain, mix, ramp);
  }

  public setStemFxRackState(stem: StemType, fxState: StemFxState): void {
    this.setStemEq(stem, fxState.eq);
    this.setStemCompressor(stem, fxState.compressor);
    this.setStemSaturation(stem, fxState.saturation);
    this.setStemDelay(stem, fxState.delay);
    this.setStemReverb(stem, fxState.reverb);
  }

  public getStemFxState(stem: StemType): StemFxState {
    return JSON.parse(JSON.stringify(this.channels[stem]?.fxState || DEFAULT_FX_RACK_STATE[stem]));
  }

  public getAllFxState(): FxRackState {
    const res = {} as FxRackState;
    for (const s of STEM_TYPES) {
      res[s] = this.getStemFxState(s);
    }
    return res;
  }

  public getCompressorGainReduction(stem: StemType): number {
    const ch = this.channels[stem];
    if (!ch || !ch.fxState.compressor.enabled) return 0;
    return ch.compressorNode.reduction || 0; // in dB (negative value)
  }

  // ---------------- AUTOMATION EVALUATION ----------------

  public applyAutomationPoint(target: string, value: number, ramp: number = 0.02): void {
    const parts = target.split('.');
    if (parts.length === 2) {
      const [scope, prop] = parts;
      if (scope === 'master') {
        if (prop === 'djFilterCutoff') {
          const filterType: 'lowpass' | 'highpass' = this.djFilterState.type === 'highpass' ? 'highpass' : 'lowpass';
          this.setDjFilter(value, filterType, this.djFilterState.Q, ramp);
        }
        else if (prop === 'volume') this.setMasterVolume(value, ramp);
      } else if (STEM_TYPES.includes(scope as StemType)) {
        const stem = scope as StemType;
        if (prop === 'volume') this.setStemVolume(stem, value, ramp);
        else if (prop === 'pan') this.setStemPan(stem, value, ramp);
        else if (prop === 'reverbMix') this.setStemReverb(stem, { mix: value }, ramp);
        else if (prop === 'delayMix') this.setStemDelay(stem, { mix: value }, ramp);
        else if (prop === 'drive') this.setStemSaturation(stem, { drive: value }, ramp);
      }
    }
  }

  // ---------------- DJ FILTER & MASTER ----------------

  public setDjFilter(
    cutoffHz: number,
    type: 'lowpass' | 'highpass' = 'lowpass',
    Q: number = 1.0,
    rampDuration: number = DEFAULT_RAMP_DURATION
  ): void {
    const clampedFreq = Math.max(MIN_FILTER_FREQ, Math.min(MAX_FILTER_FREQ, cutoffHz));
    const clampedQ = Math.max(0.0001, Math.min(20.0, Q));

    this.masterFilterNode.type = type;
    this.rampParam(this.masterFilterNode.frequency, clampedFreq, rampDuration);
    this.rampParam(this.masterFilterNode.Q, clampedQ, rampDuration);

    this.djFilterState = {
      cutoff: clampedFreq,
      type,
      Q: clampedQ,
    };
  }

  public setMasterVolume(
    volume: number,
    rampDuration: number = DEFAULT_RAMP_DURATION
  ): void {
    const clampedVol = Math.max(0, volume);
    this.masterVolume = clampedVol;
    this.rampParam(this.masterGainNode.gain, clampedVol, rampDuration);
  }

  public setLoop(loop: boolean): void {
    this.isLooping = loop;
    for (const stem of STEM_TYPES) {
      if (this.channels[stem].sourceNode) {
        this.channels[stem].sourceNode!.loop = loop;
      }
    }
  }

  public isPlaying(): boolean {
    return this.isPlayingState;
  }

  public getDuration(): number {
    return this.duration;
  }

  public getCurrentTime(): number {
    if (!this.isPlayingState) {
      return this.pausedOffset;
    }
    const elapsed = this.audioContext.currentTime - this.startTime;
    const current = this.startOffset + elapsed;

    if (this.duration > 0) {
      if (this.isLooping) {
        return current % this.duration;
      }
      return Math.min(current, this.duration);
    }
    return current;
  }

  public isReady(): boolean {
    return STEM_TYPES.some((s) => this.channels[s].buffer !== null);
  }

  public getStemStates(): Record<StemType, StemState> {
    return this.getAllStemStates();
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public getDjFilterState(): DjFilterState {
    return { ...this.djFilterState };
  }

  public getStemState(stem: StemType): StemState {
    return { ...this.channels[stem].state };
  }

  public getAllStemStates(): Record<StemType, StemState> {
    const states = {} as Record<StemType, StemState>;
    for (const stem of STEM_TYPES) {
      states[stem] = this.getStemState(stem);
    }
    return states;
  }

  public getAudioContext(): AudioContext {
    return this.audioContext;
  }

  public getStemFrequencyData(stem: StemType): Uint8Array {
    const analyser = this.channels[stem].analyserNode;
    let buffer = this.freqBuffers.get(analyser);
    if (!buffer || buffer.length !== analyser.frequencyBinCount) {
      buffer = new Uint8Array(analyser.frequencyBinCount);
      this.freqBuffers.set(analyser, buffer);
    }
    analyser.getByteFrequencyData(buffer as unknown as Uint8Array<ArrayBuffer>);
    return buffer;
  }

  public getMasterFrequencyData(): Uint8Array {
    const analyser = this.masterAnalyserNode;
    let buffer = this.freqBuffers.get(analyser);
    if (!buffer || buffer.length !== analyser.frequencyBinCount) {
      buffer = new Uint8Array(analyser.frequencyBinCount);
      this.freqBuffers.set(analyser, buffer);
    }
    analyser.getByteFrequencyData(buffer as unknown as Uint8Array<ArrayBuffer>);
    return buffer;
  }

  public getMasterTimeDomainData(): Uint8Array {
    const analyser = this.masterAnalyserNode;
    let buffer = this.waveBuffers.get(analyser);
    if (!buffer || buffer.length !== analyser.frequencyBinCount) {
      buffer = new Uint8Array(analyser.frequencyBinCount);
      this.waveBuffers.set(analyser, buffer);
    }
    analyser.getByteTimeDomainData(buffer as unknown as Uint8Array<ArrayBuffer>);
    return buffer;
  }

  public getFrequencyData(stem?: StemType): Uint8Array {
    if (stem) return this.getStemFrequencyData(stem);
    return this.getMasterFrequencyData();
  }

  public getTimeDomainData(stem?: StemType): Uint8Array {
    if (stem) return this.getWaveformData(stem);
    return this.getMasterTimeDomainData();
  }

  public getStemRMS(stem: StemType): number {
    const data = this.getStemFrequencyData(stem);
    if (data.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const val = data[i] / 255;
      sum += val * val;
    }
    return Math.sqrt(sum / data.length);
  }

  public setDuckingEnabled(enabled: boolean): void {
    this.isDuckingEnabledState = enabled;
    if (!enabled) {
      this.currentDuckingGainReduction = 1.0;
      this.applyStemGains(DEFAULT_RAMP_DURATION);
    }
  }

  public isDuckingEnabled(): boolean {
    return this.isDuckingEnabledState;
  }

  public updateSidechainDucking(): number {
    if (!this.isDuckingEnabledState || !this.isPlayingState) {
      return 1.0;
    }

    const vocalRms = this.getStemRMS('vocals');
    if (vocalRms > this.duckingThreshold) {
      this.currentDuckingGainReduction = this.duckingAmount;
    } else {
      this.currentDuckingGainReduction = 1.0;
    }

    this.applyStemGains(0.05);
    return this.currentDuckingGainReduction;
  }

  public getStemPeakOverview(stem: StemType, samplesCount: number = 800): Float32Array {
    const buffer = this.channels[stem]?.buffer;
    if (!buffer) {
      return new Float32Array(samplesCount);
    }

    const cached = this.peakCache.get(buffer);
    if (cached && cached.length === samplesCount) {
      return cached;
    }

    const rawData = buffer.getChannelData(0);
    const totalSamples = rawData.length;
    const blockSize = Math.floor(totalSamples / samplesCount);
    const peaks = new Float32Array(samplesCount);

    for (let i = 0; i < samplesCount; i++) {
      const start = i * blockSize;
      let maxVal = 0;
      for (let j = 0; j < blockSize; j++) {
        const val = Math.abs(rawData[start + j] || 0);
        if (val > maxVal) maxVal = val;
      }
      peaks[i] = maxVal;
    }

    this.peakCache.set(buffer, peaks);
    return peaks;
  }

  public getStemPeakData(stem: StemType, samplesCount: number = 800): Float32Array {
    return this.getStemPeakOverview(stem, samplesCount);
  }

  public getWaveformData(stem: StemType): Uint8Array {
    const analyser = this.channels[stem].analyserNode;
    let buffer = this.waveBuffers.get(analyser);
    if (!buffer || buffer.length !== analyser.frequencyBinCount) {
      buffer = new Uint8Array(analyser.frequencyBinCount);
      this.waveBuffers.set(analyser, buffer);
    }
    analyser.getByteTimeDomainData(buffer as unknown as Uint8Array<ArrayBuffer>);
    return buffer;
  }

  private rampParam(param: AudioParam, targetValue: number, duration: number): void {
    const now = this.audioContext.currentTime;
    try {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      if (duration > 0) {
        param.linearRampToValueAtTime(targetValue, now + duration);
      } else {
        param.setValueAtTime(targetValue, now);
      }
    } catch {
      param.value = targetValue;
    }
  }

  public onEnded(callback: () => void): () => void {
    this.endedCallbacks.add(callback);
    return () => this.endedCallbacks.delete(callback);
  }

  private emitEnded(): void {
    this.endedCallbacks.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Error in onEnded callback:', err);
      }
    });
  }

  public async dispose(): Promise<void> {
    this.pause();
    this.endedCallbacks.clear();
    for (const stem of STEM_TYPES) {
      this.channels[stem].buffer = null;
    }
    if (!this.isExternalContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }
  }
}
