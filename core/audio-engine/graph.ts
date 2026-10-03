import { Project } from '../project-model/types';
import { evaluateKeyframe } from '../dsp/keyframes';

export interface TrackAudioNodes {
  trackId: string;
  inputGain: GainNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  panner: StereoPannerNode;
  volumeGain: GainNode;
  reverbSendGain: GainNode;
  outputNode: GainNode;
}

export interface ActiveClipSource {
  clipId: string;
  sourceNode: AudioBufferSourceNode;
  gainNode: GainNode;
  pannerNode: StereoPannerNode;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private isPlayingState: boolean = false;
  private playheadPosition: number = 0; // In seconds
  private startCtxTime: number = 0;
  private startPlayheadTime: number = 0;

  // Master Nodes
  private masterGain: GainNode | null = null;
  private masterEqLow: BiquadFilterNode | null = null;
  private masterEqMid: BiquadFilterNode | null = null;
  private masterEqHigh: BiquadFilterNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;

  // Reverb Bus
  private reverbBusGain: GainNode | null = null;
  private reverbConvolver: ConvolverNode | null = null;

  // Per-track routing
  private trackNodes: Map<string, TrackAudioNodes> = new Map();
  private activeSources: ActiveClipSource[] = [];

  // Project reference
  private currentProject: Project | null = null;
  private audioBuffers: Map<string, AudioBuffer> = new Map();

  // Animation frame / meter listeners
  private meterListeners: ((levels: { left: number; right: number; lufsEstimate: number }) => void)[] = [];
  private timeListeners: ((currentTime: number) => void)[] = [];
  private animFrameId: number | null = null;

  constructor() {}

  public async initAudioContext(): Promise<AudioContext> {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      this.setupMasterGraph();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  public getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  public registerAudioBuffer(sourceId: string, buffer: AudioBuffer) {
    this.audioBuffers.set(sourceId, buffer);
  }

  public getAudioBuffer(sourceId: string): AudioBuffer | undefined {
    return this.audioBuffers.get(sourceId);
  }

  private setupMasterGraph(): void {
    if (!this.ctx) return;

    // Master EQ
    this.masterEqLow = this.ctx.createBiquadFilter();
    this.masterEqLow.type = 'lowshelf';
    this.masterEqLow.frequency.value = 120;
    this.masterEqLow.gain.value = 0;

    this.masterEqMid = this.ctx.createBiquadFilter();
    this.masterEqMid.type = 'peaking';
    this.masterEqMid.frequency.value = 2500;
    this.masterEqMid.Q.value = 1.0;
    this.masterEqMid.gain.value = 0;

    this.masterEqHigh = this.ctx.createBiquadFilter();
    this.masterEqHigh.type = 'highshelf';
    this.masterEqHigh.frequency.value = 8000;
    this.masterEqHigh.gain.value = 0;

    // Master Compressor
    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -12;
    this.masterCompressor.knee.value = 10;
    this.masterCompressor.ratio.value = 3;
    this.masterCompressor.attack.value = 0.003;
    this.masterCompressor.release.value = 0.25;

    // Master Gain & Analyser
    this.masterGain = this.ctx.createGain();
    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 512;
    this.masterAnalyser.smoothingTimeConstant = 0.6;

    // Master Reverb Bus (Impulse generator)
    this.reverbBusGain = this.ctx.createGain();
    this.reverbBusGain.gain.value = 0.5;
    this.reverbConvolver = this.ctx.createConvolver();
    this.reverbConvolver.buffer = this.createSyntheticImpulseResponse(this.ctx, 1.8, 2.0);

    // Chain: EQ Low -> Mid -> High -> Compressor -> MasterGain -> Analyser -> Destination
    this.masterEqLow.connect(this.masterEqMid);
    this.masterEqMid.connect(this.masterEqHigh);
    this.masterEqHigh.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterGain);
    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);

    // Reverb bus connection
    this.reverbConvolver.connect(this.reverbBusGain);
    this.reverbBusGain.connect(this.masterEqLow);

    this.startMeterPolling();
  }

  private createSyntheticImpulseResponse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = (1 - i / length) ** decay;
      left[i] = ((Math.random() * 2) - 1) * n;
      right[i] = ((Math.random() * 2) - 1) * n;
    }
    return impulse;
  }

  public syncProject(project: Project): void {
    this.currentProject = project;
    if (!this.ctx || !this.masterEqLow || !this.reverbConvolver) return;

    // Ensure all tracks have nodes
    const hasSolo = project.tracks.some((t) => t.isSoloed);

    project.tracks.forEach((track) => {
      let nodes = this.trackNodes.get(track.id);
      if (!nodes) {
        nodes = this.createTrackNodes(track.id);
        this.trackNodes.set(track.id, nodes);
      }

      // Update track parameters
      const effectiveMute = track.isMuted || (hasSolo && !track.isSoloed);
      nodes.volumeGain.gain.setTargetAtTime(effectiveMute ? 0 : track.volume, this.ctx!.currentTime, 0.02);
      nodes.panner.pan.setTargetAtTime(track.pan, this.ctx!.currentTime, 0.02);
      nodes.eqLow.gain.setTargetAtTime(track.eqLowGain, this.ctx!.currentTime, 0.02);
      nodes.eqMid.gain.setTargetAtTime(track.eqMidGain, this.ctx!.currentTime, 0.02);
      nodes.eqHigh.gain.setTargetAtTime(track.eqHighGain, this.ctx!.currentTime, 0.02);
      nodes.reverbSendGain.gain.setTargetAtTime(track.reverbSend, this.ctx!.currentTime, 0.02);
    });

    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(project.masterVolume, this.ctx.currentTime, 0.02);
    }
  }

  private createTrackNodes(trackId: string): TrackAudioNodes {
    if (!this.ctx || !this.masterEqLow || !this.reverbConvolver) {
      throw new Error('Audio engine not initialized');
    }

    const inputGain = this.ctx.createGain();
    const eqLow = this.ctx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 150;

    const eqMid = this.ctx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1500;
    eqMid.Q.value = 1.0;

    const eqHigh = this.ctx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 6000;

    const panner = this.ctx.createStereoPanner();
    const volumeGain = this.ctx.createGain();
    const reverbSendGain = this.ctx.createGain();
    const outputNode = this.ctx.createGain();

    // Input -> EQ Low -> EQ Mid -> EQ High -> Panner -> VolumeGain -> OutputNode -> Master
    inputGain.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(panner);
    panner.connect(volumeGain);
    volumeGain.connect(outputNode);
    outputNode.connect(this.masterEqLow);

    // Reverb Send
    volumeGain.connect(reverbSendGain);
    reverbSendGain.connect(this.reverbConvolver);

    return {
      trackId,
      inputGain,
      eqLow,
      eqMid,
      eqHigh,
      panner,
      volumeGain,
      reverbSendGain,
      outputNode,
    };
  }

  public async play(): Promise<void> {
    await this.initAudioContext();
    if (!this.ctx || !this.currentProject) return;

    this.stopActiveSources();
    this.isPlayingState = true;
    this.startCtxTime = this.ctx.currentTime;
    this.startPlayheadTime = this.playheadPosition;

    // Schedule all clips that overlap or are in the future of the playhead
    const timelineTime = this.playheadPosition;

    this.currentProject.clips.forEach((clip) => {
      const clipDuration = clip.sourceOut - clip.sourceIn;
      const clipEndTimeline = clip.startTime + clipDuration;

      if (clipEndTimeline <= timelineTime) return; // Clip is already in past

      const buffer = this.audioBuffers.get(clip.sourceId);
      if (!buffer) return;

      const trackNode = this.trackNodes.get(clip.trackId);
      if (!trackNode) return;

      const sourceNode = this.ctx!.createBufferSource();
      sourceNode.buffer = buffer;

      const clipGain = this.ctx!.createGain();
      const clipPanner = this.ctx!.createStereoPanner();

      // Non-destructive Clip parameters
      clipGain.gain.value = clip.isMuted ? 0 : clip.gain;
      clipPanner.pan.value = clip.pan;

      // Apply keyframe volume if present
      const volLane = clip.automationLanes.find((l) => l.parameter === 'volume');
      if (volLane && volLane.points.length > 0) {
        clipGain.gain.value = evaluateKeyframe(volLane, 0);
      }

      sourceNode.connect(clipGain);
      clipGain.connect(clipPanner);
      clipPanner.connect(trackNode.inputGain);

      let scheduleAtCtxTime: number;
      let bufferOffset: number;
      let playDuration: number;

      if (timelineTime >= clip.startTime) {
        // Playhead starts mid-clip
        const offsetInClip = timelineTime - clip.startTime;
        bufferOffset = clip.sourceIn + offsetInClip;
        playDuration = clipDuration - offsetInClip;
        scheduleAtCtxTime = this.ctx!.currentTime;
      } else {
        // Playhead starts before clip starts
        const delayUntilClip = clip.startTime - timelineTime;
        bufferOffset = clip.sourceIn;
        playDuration = clipDuration;
        scheduleAtCtxTime = this.ctx!.currentTime + delayUntilClip;
      }

      // Apply Fade In / Fade Out automation safely
      if (!clip.isMuted && clip.fadeIn && clip.fadeIn.duration > 0 && (clip.gain || 1.0) > 0.0001) {
        const fadeStart = scheduleAtCtxTime;
        const fadeEnd = scheduleAtCtxTime + clip.fadeIn.duration;
        clipGain.gain.setValueAtTime(0.001, fadeStart);
        clipGain.gain.exponentialRampToValueAtTime(Math.max(0.001, clip.gain || 1.0), fadeEnd);
      }

      if (!clip.isMuted && clip.fadeOut && clip.fadeOut.duration > 0 && (clip.gain || 1.0) > 0.0001) {
        const fadeStart = scheduleAtCtxTime + playDuration - clip.fadeOut.duration;
        const fadeEnd = scheduleAtCtxTime + playDuration;
        clipGain.gain.setValueAtTime(Math.max(0.001, clip.gain || 1.0), Math.max(scheduleAtCtxTime, fadeStart));
        clipGain.gain.exponentialRampToValueAtTime(0.0001, fadeEnd);
      }

      sourceNode.start(scheduleAtCtxTime, bufferOffset, playDuration);

      this.activeSources.push({
        clipId: clip.id,
        sourceNode,
        gainNode: clipGain,
        pannerNode: clipPanner,
      });
    });
  }

  public pause(): void {
    if (!this.isPlayingState) return;
    this.playheadPosition = this.getCurrentTime();
    this.stopActiveSources();
    this.isPlayingState = false;
  }

  public stop(): void {
    this.pause();
    this.seek(0);
  }

  public seek(targetTime: number): void {
    const wasPlaying = this.isPlayingState;
    if (wasPlaying) {
      this.pause();
    }
    this.playheadPosition = Math.max(0, targetTime);
    this.timeListeners.forEach((l) => l(this.playheadPosition));
    if (wasPlaying) {
      this.play();
    }
  }

  public getCurrentTime(): number {
    if (!this.isPlayingState || !this.ctx) {
      return this.playheadPosition;
    }
    return Math.max(0, this.startPlayheadTime + (this.ctx.currentTime - this.startCtxTime));
  }

  public isPlaying(): boolean {
    return this.isPlayingState;
  }

  public stopActiveSources(): void {
    this.activeSources.forEach((s) => {
      try {
        s.sourceNode.stop();
        s.sourceNode.disconnect();
      } catch {
        // Ignore already stopped sources
      }
    });
    this.activeSources = [];
  }

  public onMeterUpdate(listener: (levels: { left: number; right: number; lufsEstimate: number }) => void): () => void {
    this.meterListeners.push(listener);
    return () => {
      this.meterListeners = this.meterListeners.filter((l) => l !== listener);
    };
  }

  public onTimeUpdate(listener: (currentTime: number) => void): () => void {
    this.timeListeners.push(listener);
    return () => {
      this.timeListeners = this.timeListeners.filter((l) => l !== listener);
    };
  }

  private startMeterPolling(): void {
    if (this.animFrameId) return;

    const dataArray = new Uint8Array(256);
    let lastMeterTick = 0;
    let lastTimeTick = 0;

    const update = (now: number) => {
      if (this.isPlayingState) {
        // Smooth ~30 FPS meter updates (avoids React render queue clogging)
        if (this.masterAnalyser && now - lastMeterTick >= 33) {
          lastMeterTick = now;
          this.masterAnalyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(1.0, avg / 128);

          // Approximate LUFS and stereo peak
          const peakL = normalized;
          const peakR = Math.max(0, normalized * (0.95 + Math.random() * 0.1));
          const lufsEstimate = -70 + normalized * 56; // range -70dB to -14dB

          for (let i = 0; i < this.meterListeners.length; i++) {
            this.meterListeners[i]({ left: peakL, right: peakR, lufsEstimate });
          }
        }

        // Smooth ~30 FPS time updates for React state
        if (now - lastTimeTick >= 33) {
          lastTimeTick = now;
          const currTime = this.getCurrentTime();
          for (let i = 0; i < this.timeListeners.length; i++) {
            this.timeListeners[i](currTime);
          }
        }
      }
      this.animFrameId = requestAnimationFrame(update);
    };

    this.animFrameId = requestAnimationFrame(update);
  }

  public getAllRegisteredAudioBuffers(): Map<string, AudioBuffer> {
    return this.audioBuffers;
  }

  private previewSourceNode: AudioBufferSourceNode | null = null;

  public async previewAudio(sourceIdOrBuffer: string | AudioBuffer): Promise<void> {
    await this.initAudioContext();
    if (!this.ctx) return;

    if (this.previewSourceNode) {
      try {
        this.previewSourceNode.stop();
        this.previewSourceNode.disconnect();
      } catch {}
      this.previewSourceNode = null;
    }

    let buffer: AudioBuffer | undefined;
    if (typeof sourceIdOrBuffer === 'string') {
      buffer = this.audioBuffers.get(sourceIdOrBuffer);
    } else {
      buffer = sourceIdOrBuffer;
    }

    if (!buffer) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.8;

    src.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
    this.previewSourceNode = src;
  }

  public stopPreviewAudio(): void {
    if (this.previewSourceNode) {
      try {
        this.previewSourceNode.stop();
        this.previewSourceNode.disconnect();
      } catch {}
      this.previewSourceNode = null;
    }
  }

  public playMetronomeTick(isAccent = false): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isAccent ? 1200 : 800, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  public dispose(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.stopActiveSources();
    this.stopPreviewAudio();
    if (this.ctx) {
      this.ctx.close();
    }
  }
}

