import { STEM_TYPES, StemState, StemType } from '../types';

export const DEFAULT_RAMP_DURATION = 0.03; // 30ms click-free ramp
export const MIN_FILTER_FREQ = 20;
export const MAX_FILTER_FREQ = 20000;
export const DEFAULT_FFT_SIZE = 1024;

export interface StemChannel {
  type: StemType;
  buffer: AudioBuffer | null;
  sourceNode: AudioBufferSourceNode | null;
  pannerNode: StereoPannerNode | null;
  gainNode: GainNode;
  analyserNode: AnalyserNode;
  state: StemState;
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

  // Reusable typed array buffers for visualizers to prevent GC pressure
  private freqBuffers: WeakMap<AnalyserNode, Uint8Array> = new WeakMap();
  private waveBuffers: WeakMap<AnalyserNode, Uint8Array> = new WeakMap();

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

    // 2. Initialize Channels for 4 stems
    this.channels = {} as Record<StemType, StemChannel>;

    for (const stem of STEM_TYPES) {
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

      // Connect: (Panner ->) Gain -> Analyser -> Master Filter
      if (pannerNode) {
        pannerNode.connect(gainNode);
      }
      gainNode.connect(analyserNode);
      analyserNode.connect(this.masterFilterNode);

      this.channels[stem] = {
        type: stem,
        buffer: null,
        sourceNode: null,
        pannerNode,
        gainNode,
        analyserNode,
        state: {
          volume: 1.0,
          muted: false,
          solo: false,
          pan: 0.0,
        },
      };
    }
  }

  /**
   * Loads stem audio files from provided URLs or track ID mappings.
   * Concurrently fetches and decodes all 4 stems into memory.
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
    });

    await Promise.all(loadPromises);

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
   * Decode ArrayBuffer into AudioBuffer with cross-browser fallback
   */
  private decodeAudio(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      // In case decodeAudioData detaches the buffer, we slice a copy
      const bufferCopy = arrayBuffer.slice(0);
      const res = this.audioContext.decodeAudioData(
        bufferCopy,
        (decoded) => resolve(decoded),
        (err) => reject(err)
      );
      if (res && typeof res.then === 'function') {
        res.then(resolve).catch(reject);
      }
    });
  }

  /**
   * Starts synchronous playback across all 4 stems from given or current offset.
   */
  public async play(offsetSeconds?: number): Promise<void> {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Stop active sources before creating new synchronized sources
    this.stopActiveSources();

    const targetOffset =
      offsetSeconds !== undefined ? offsetSeconds : this.pausedOffset;
    const clampedOffset = Math.max(0, Math.min(targetOffset, this.duration));

    const now = this.audioContext.currentTime;
    this.startTime = now;
    this.startOffset = clampedOffset;
    this.pausedOffset = clampedOffset;
    this.isPlayingState = true;

    for (const stem of STEM_TYPES) {
      const channel = this.channels[stem];
      if (!channel.buffer) continue;

      const source = this.audioContext.createBufferSource();
      source.buffer = channel.buffer;
      source.loop = this.isLooping;

      // Connect source to channel DSP chain
      if (channel.pannerNode) {
        source.connect(channel.pannerNode);
      } else {
        source.connect(channel.gainNode);
      }

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

      // Start source synchronously at audioContext currentTime
      source.start(now, clampedOffset);
      channel.sourceNode = source;
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
   * Seeks to a specific timestamp in seconds.
   * If currently playing, seamlessly restarts sources from the new offset.
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
   * Stop and disconnect active source nodes.
   */
  private stopActiveSources(): void {
    for (const stem of STEM_TYPES) {
      const channel = this.channels[stem];
      if (channel.sourceNode) {
        try {
          channel.sourceNode.stop();
          channel.sourceNode.disconnect();
        } catch {
          // Source may have already completed
        }
        channel.sourceNode = null;
      }
    }
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

  /**
   * Mutes or unmutes a stem while preserving configured volume level.
   */
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

  /**
   * Solos or unsolos a stem.
   * When any stem is soloed, only soloed stems are audible.
   */
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

  /**
   * Recalculate and apply effective gain values across all 4 stems.
   */
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
        } else {
          targetGain = 0;
        }
      }

      this.rampParam(ch.gainNode.gain, targetGain, rampDuration);
    }
  }

  /**
   * Sets stereo panning for a stem (-1.0 left to 1.0 right).
   */
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

  /**
   * Modulates the Master DJ Filter (Lowpass / Highpass sweep with resonance).
   */
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

  /**
   * Sets master output volume with smooth ramping.
   */
  public setMasterVolume(
    volume: number,
    rampDuration: number = DEFAULT_RAMP_DURATION
  ): void {
    const clampedVol = Math.max(0, volume);
    this.masterVolume = clampedVol;
    this.rampParam(this.masterGainNode.gain, clampedVol, rampDuration);
  }

  /**
   * Enable or disable looping for synchronized playback.
   */
  public setLoop(loop: boolean): void {
    this.isLooping = loop;
    for (const stem of STEM_TYPES) {
      const source = this.channels[stem].sourceNode;
      if (source) {
        source.loop = loop;
      }
    }
  }

  /**
   * Helper to ramp AudioParam smoothly avoiding audio pops.
   */
  private rampParam(
    param: AudioParam,
    targetValue: number,
    rampDuration: number = DEFAULT_RAMP_DURATION
  ): void {
    const now = this.audioContext.currentTime;
    try {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      if (rampDuration > 0) {
        param.linearRampToValueAtTime(targetValue, now + rampDuration);
      } else {
        param.setValueAtTime(targetValue, now);
      }
    } catch {
      param.value = targetValue;
    }
  }

  /**
   * Returns 8-bit FFT frequency bin data for visualization.
   */
  public getFrequencyData(stem?: StemType): Uint8Array {
    const analyser =
      stem && this.channels[stem]
        ? this.channels[stem].analyserNode
        : this.masterAnalyserNode;

    let buffer = this.freqBuffers.get(analyser);
    if (!buffer || buffer.length !== analyser.frequencyBinCount) {
      buffer = new Uint8Array(analyser.frequencyBinCount);
      this.freqBuffers.set(analyser, buffer);
    }

    analyser.getByteFrequencyData(buffer as unknown as Uint8Array<ArrayBuffer>);
    return buffer;
  }

  /**
   * Returns 8-bit time-domain waveform data for oscilloscope rendering.
   */
  public getWaveformData(stem?: StemType): Uint8Array {
    const analyser =
      stem && this.channels[stem]
        ? this.channels[stem].analyserNode
        : this.masterAnalyserNode;

    let buffer = this.waveBuffers.get(analyser);
    if (!buffer || buffer.length !== analyser.fftSize) {
      buffer = new Uint8Array(analyser.fftSize);
      this.waveBuffers.set(analyser, buffer);
    }

    analyser.getByteTimeDomainData(buffer as unknown as Uint8Array<ArrayBuffer>);
    return buffer;
  }

  /**
   * Returns current playback position in seconds.
   */
  public getCurrentTime(): number {
    if (this.isPlayingState) {
      const elapsed = this.audioContext.currentTime - this.startTime;
      const current = this.startOffset + elapsed;
      if (this.isLooping && this.duration > 0) {
        return current % this.duration;
      }
      return Math.min(current, this.duration);
    }
    return this.pausedOffset;
  }

  /**
   * Returns total track duration in seconds.
   */
  public getDuration(): number {
    return this.duration;
  }

  /**
   * Returns whether audio is currently playing.
   */
  public isPlaying(): boolean {
    return this.isPlayingState;
  }

  /**
   * Returns whether looping is enabled.
   */
  public getIsLooping(): boolean {
    return this.isLooping;
  }

  /**
   * Returns whether all stem buffers are decoded and ready.
   */
  public isReady(): boolean {
    return STEM_TYPES.every((s) => this.channels[s].buffer !== null);
  }

  /**
   * Returns copy of state for a given stem.
   */
  public getStemState(stem: StemType): StemState {
    return { ...this.channels[stem].state };
  }

  /**
   * Returns snapshot of all stem states.
   */
  public getStemStates(): Record<StemType, StemState> {
    const states = {} as Record<StemType, StemState>;
    for (const stem of STEM_TYPES) {
      states[stem] = { ...this.channels[stem].state };
    }
    return states;
  }

  /**
   * Returns current DJ Filter configuration.
   */
  public getDjFilterState(): DjFilterState {
    return { ...this.djFilterState };
  }

  /**
   * Returns current master output volume.
   */
  public getMasterVolume(): number {
    return this.masterVolume;
  }

  /**
   * Returns direct reference to underlying AudioContext.
   */
  public getAudioContext(): AudioContext {
    return this.audioContext;
  }

  /**
   * Registers a playback ended callback.
   * Returns an unregister function.
   */
  public onEnded(callback: () => void): () => void {
    this.endedCallbacks.add(callback);
    return () => {
      this.endedCallbacks.delete(callback);
    };
  }

  private emitEnded(): void {
    for (const cb of this.endedCallbacks) {
      try {
        cb();
      } catch (err) {
        console.error('Error in onEnded callback:', err);
      }
    }
  }

  /**
   * Disposes all active sources, disconnects DSP nodes, and cleans up AudioContext.
   */
  public dispose(closeContext: boolean = !this.isExternalContext): void {
    this.pause();
    this.endedCallbacks.clear();

    // Disconnect channel nodes
    for (const stem of STEM_TYPES) {
      const channel = this.channels[stem];
      if (channel.pannerNode) {
        try {
          channel.pannerNode.disconnect();
        } catch {}
      }
      try {
        channel.gainNode.disconnect();
        channel.analyserNode.disconnect();
      } catch {}
      channel.buffer = null;
    }

    // Disconnect master nodes
    try {
      this.masterFilterNode.disconnect();
      this.masterGainNode.disconnect();
      this.masterAnalyserNode.disconnect();
    } catch {}

    if (closeContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
    }
  }
}
