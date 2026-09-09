import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioGraphEngine, MIN_FILTER_FREQ, MAX_FILTER_FREQ } from './audioGraph';
import { STEM_TYPES } from '../types';

// Mock Web Audio API classes
class MockAudioParam {
  value: number;
  setValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  linearRampToValueAtTime = vi.fn((val: number) => {
    this.value = val;
  });
  cancelScheduledValues = vi.fn();

  constructor(defaultValue = 1.0) {
    this.value = defaultValue;
  }
}

class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam(1.0);
}

class MockStereoPannerNode extends MockAudioNode {
  pan = new MockAudioParam(0.0);
}

class MockBiquadFilterNode extends MockAudioNode {
  frequency = new MockAudioParam(20000);
  gain = new MockAudioParam(0.0);
  Q = new MockAudioParam(1.0);
  type: BiquadFilterType = 'lowpass';
}

class MockWaveShaperNode extends MockAudioNode {
  curve: Float32Array | null = null;
  oversample: OverSampleType = 'none';
}

class MockDynamicsCompressorNode extends MockAudioNode {
  threshold = new MockAudioParam(-24);
  ratio = new MockAudioParam(4);
  attack = new MockAudioParam(0.01);
  release = new MockAudioParam(0.2);
  knee = new MockAudioParam(10);
  reduction = -2.5;
}

class MockDelayNode extends MockAudioNode {
  delayTime = new MockAudioParam(0.25);
}

class MockConvolverNode extends MockAudioNode {
  buffer: AudioBuffer | null = null;
}

class MockAnalyserNode extends MockAudioNode {
  fftSize = 1024;
  frequencyBinCount = 512;
  smoothingTimeConstant = 0.8;
  minDecibels = -90;
  maxDecibels = -10;
  getByteFrequencyData = vi.fn((arr: Uint8Array) => {
    arr.fill(128);
  });
  getByteTimeDomainData = vi.fn((arr: Uint8Array) => {
    arr.fill(128);
  });
}

class MockAudioBufferSourceNode extends MockAudioNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
}

class MockAudioBuffer {
  duration: number;
  numberOfChannels: number;
  sampleRate: number;
  length: number;
  private channelData: Float32Array;

  constructor(duration = 120) {
    this.duration = duration;
    this.numberOfChannels = 2;
    this.sampleRate = 44100;
    this.length = duration * 44100;
    this.channelData = new Float32Array(this.length);
    for (let i = 0; i < this.length; i++) {
      this.channelData[i] = Math.sin((i / 44100) * 440 * Math.PI * 2) * 0.8;
    }
  }

  getChannelData(_channel: number): Float32Array {
    return this.channelData;
  }
}

class MockAudioContext {
  currentTime = 0;
  sampleRate = 44100;
  state: AudioContextState = 'running';
  destination = new MockAudioNode();

  createGain = vi.fn(() => new MockGainNode());
  createStereoPanner = vi.fn(() => new MockStereoPannerNode());
  createBiquadFilter = vi.fn(() => new MockBiquadFilterNode());
  createWaveShaper = vi.fn(() => new MockWaveShaperNode());
  createDynamicsCompressor = vi.fn(() => new MockDynamicsCompressorNode());
  createDelay = vi.fn(() => new MockDelayNode());
  createConvolver = vi.fn(() => new MockConvolverNode());
  createBuffer = vi.fn((_channels: number, length: number, rate: number) => {
    return new MockAudioBuffer(length / rate) as unknown as AudioBuffer;
  });
  createAnalyser = vi.fn(() => new MockAnalyserNode());
  createBufferSource = vi.fn(() => new MockAudioBufferSourceNode());
  decodeAudioData = vi.fn((_buffer: ArrayBuffer, successCallback?: (b: AudioBuffer) => void) => {
    const audioBuffer = new MockAudioBuffer(150) as unknown as AudioBuffer;
    if (successCallback) {
      successCallback(audioBuffer);
    }
    return Promise.resolve(audioBuffer);
  });
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });
}

describe('AudioGraphEngine', () => {
  let mockContext: MockAudioContext;
  let engine: AudioGraphEngine;

  beforeEach(() => {
    mockContext = new MockAudioContext();
    engine = new AudioGraphEngine(mockContext as unknown as AudioContext);
  });

  it('initializes DSP graph with 4 stem channels, 5-insert FX rack and master chain', () => {
    expect(mockContext.createBiquadFilter).toHaveBeenCalled();
    expect(mockContext.createGain).toHaveBeenCalled();
    expect(mockContext.createAnalyser).toHaveBeenCalled();
    expect(mockContext.createDynamicsCompressor).toHaveBeenCalled();
    expect(mockContext.createWaveShaper).toHaveBeenCalled();
    expect(mockContext.createDelay).toHaveBeenCalled();
    expect(mockContext.createConvolver).toHaveBeenCalled();

    expect(engine.isReady()).toBe(false);
    expect(engine.isPlaying()).toBe(false);
    expect(engine.getDuration()).toBe(0);
    expect(engine.getMasterVolume()).toBe(1.0);

    const states = engine.getStemStates();
    for (const stem of STEM_TYPES) {
      expect(states[stem]).toEqual({
        volume: 1.0,
        muted: false,
        solo: false,
        pan: 0.0,
      });
    }
  });

  it('loads stems from URLs and computes maximum track duration', async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      const buffer = new ArrayBuffer(1024);
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(buffer),
      });
    });
    globalThis.fetch = mockFetch;

    const urls = {
      vocals: 'http://localhost/vocals.wav',
      drums: 'http://localhost/drums.wav',
      bass: 'http://localhost/bass.wav',
      other: 'http://localhost/other.wav',
    };

    await engine.loadStems(urls);

    expect(engine.isReady()).toBe(true);
    expect(engine.getDuration()).toBe(150);
  });

  it('starts synchronized 4-stem playback and tracks time', async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      const buffer = new ArrayBuffer(1024);
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(buffer),
      });
    });
    globalThis.fetch = mockFetch;

    await engine.loadStems({
      vocals: 'http://localhost/vocals.wav',
      drums: 'http://localhost/drums.wav',
      bass: 'http://localhost/bass.wav',
      other: 'http://localhost/other.wav',
    });

    await engine.play(0);
    expect(engine.isPlaying()).toBe(true);
    expect(engine.getCurrentTime()).toBe(0);

    mockContext.currentTime = 5.5;
    expect(engine.getCurrentTime()).toBeCloseTo(5.5, 2);
  });

  it('configures stem FX rack parameters (EQ, Compressor, Reverb, Delay, Saturation)', () => {
    engine.setStemEq('vocals', { lowGain: 3.5, midGain: -2.0, highGain: 4.0 });
    const fxVocals = engine.getStemFxState('vocals');
    expect(fxVocals.eq.lowGain).toBe(3.5);
    expect(fxVocals.eq.midGain).toBe(-2.0);
    expect(fxVocals.eq.highGain).toBe(4.0);

    engine.setStemCompressor('drums', { threshold: -14, ratio: 8 });
    const fxDrums = engine.getStemFxState('drums');
    expect(fxDrums.compressor.threshold).toBe(-14);
    expect(fxDrums.compressor.ratio).toBe(8);

    engine.setStemSaturation('bass', { drive: 0.8, mix: 0.6 });
    const fxBass = engine.getStemFxState('bass');
    expect(fxBass.saturation.drive).toBe(0.8);
    expect(fxBass.saturation.mix).toBe(0.6);

    engine.setStemDelay('other', { time: 0.35, feedback: 0.5 });
    const fxOther = engine.getStemFxState('other');
    expect(fxOther.delay.time).toBe(0.35);
    expect(fxOther.delay.feedback).toBe(0.5);
  });

  it('evaluates and applies automation points to stem levels and master filter', () => {
    engine.applyAutomationPoint('vocals.volume', 0.65);
    expect(engine.getStemState('vocals').volume).toBe(0.65);

    engine.applyAutomationPoint('master.djFilterCutoff', 3200);
    expect(engine.getDjFilterState().cutoff).toBe(3200);
  });

  it('adjusts DJ Filter cutoff within valid boundaries', () => {
    engine.setDjFilter(5000, 'lowpass', 2.5);
    const filter = engine.getDjFilterState();
    expect(filter.cutoff).toBe(5000);
    expect(filter.type).toBe('lowpass');
    expect(filter.Q).toBe(2.5);

    engine.setDjFilter(999999);
    expect(engine.getDjFilterState().cutoff).toBe(MAX_FILTER_FREQ);

    engine.setDjFilter(-50);
    expect(engine.getDjFilterState().cutoff).toBe(MIN_FILTER_FREQ);
  });
});
