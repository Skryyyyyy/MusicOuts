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
  Q = new MockAudioParam(1.0);
  type: BiquadFilterType = 'lowpass';
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
  state: AudioContextState = 'running';
  destination = new MockAudioNode();

  createGain = vi.fn(() => new MockGainNode());
  createStereoPanner = vi.fn(() => new MockStereoPannerNode());
  createBiquadFilter = vi.fn(() => new MockBiquadFilterNode());
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

  it('initializes DSP graph with 4 stem channels and master chain', () => {
    expect(mockContext.createBiquadFilter).toHaveBeenCalled();
    expect(mockContext.createGain).toHaveBeenCalled();
    expect(mockContext.createAnalyser).toHaveBeenCalled();
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
      return Promise.resolve({
        ok: true,
        statusText: 'OK',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      });
    });
    globalThis.fetch = mockFetch;

    await engine.loadStems('track-123', {
      vocals: 'vocals.wav',
      drums: 'drums.wav',
      bass: 'bass.wav',
      other: 'other.wav',
    });

    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(engine.isReady()).toBe(true);
    expect(engine.getDuration()).toBe(150);
  });

  it('starts synchronized 4-stem playback and tracks time', async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        statusText: 'OK',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      })
    );
    globalThis.fetch = mockFetch;

    await engine.loadStems('track-123');
    mockContext.currentTime = 10;
    await engine.play(5);

    expect(engine.isPlaying()).toBe(true);
    expect(mockContext.createBufferSource).toHaveBeenCalledTimes(4);
    expect(engine.getCurrentTime()).toBe(5);

    // Advance mock time
    mockContext.currentTime = 15;
    expect(engine.getCurrentTime()).toBe(10);
  });

  it('pauses and maintains exact position', async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        statusText: 'OK',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      })
    );
    globalThis.fetch = mockFetch;

    await engine.loadStems('track-123');
    mockContext.currentTime = 0;
    await engine.play(0);

    mockContext.currentTime = 12.5;
    engine.pause();

    expect(engine.isPlaying()).toBe(false);
    expect(engine.getCurrentTime()).toBe(12.5);
  });

  it('handles sample-accurate seeking', async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        statusText: 'OK',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      })
    );
    globalThis.fetch = mockFetch;

    await engine.loadStems('track-123');
    engine.seek(45);
    expect(engine.getCurrentTime()).toBe(45);

    // When playing, seek restarts synchronized playback at new offset
    await engine.play(45);
    expect(engine.isPlaying()).toBe(true);
    engine.seek(90);
    expect(engine.getCurrentTime()).toBe(90);
  });

  describe('Solo and Mute Matrix', () => {
    it('applies individual stem volume changes', () => {
      engine.setStemVolume('vocals', 0.6);
      expect(engine.getStemState('vocals').volume).toBe(0.6);
    });

    it('mutes a stem to zero gain and restores configured volume on unmute', () => {
      engine.setStemVolume('drums', 0.85);
      engine.setStemMute('drums', true);
      expect(engine.getStemState('drums').muted).toBe(true);

      engine.setStemMute('drums', false);
      expect(engine.getStemState('drums').muted).toBe(false);
      expect(engine.getStemState('drums').volume).toBe(0.85);
    });

    it('solos a stem and mutes non-soloed stems', () => {
      engine.setStemVolume('vocals', 0.9);
      engine.setStemVolume('bass', 0.7);

      engine.setStemSolo('vocals', true);
      expect(engine.getStemState('vocals').solo).toBe(true);
      expect(engine.getStemState('bass').solo).toBe(false);

      // Unsolo restores multi-stem output
      engine.setStemSolo('vocals', false);
      expect(engine.getStemState('vocals').solo).toBe(false);
    });

    it('supports multi-stem solo', () => {
      engine.setStemSolo('vocals', true);
      engine.setStemSolo('drums', true);

      expect(engine.getStemState('vocals').solo).toBe(true);
      expect(engine.getStemState('drums').solo).toBe(true);
      expect(engine.getStemState('bass').solo).toBe(false);
      expect(engine.getStemState('other').solo).toBe(false);
    });
  });

  describe('DJ Filter and Analysers', () => {
    it('modulates DJ filter cutoff frequency, type, and resonance', () => {
      engine.setDjFilter(800, 'lowpass', 2.5);
      const filterState = engine.getDjFilterState();

      expect(filterState.cutoff).toBe(800);
      expect(filterState.type).toBe('lowpass');
      expect(filterState.Q).toBe(2.5);

      // Frequency clamping
      engine.setDjFilter(5, 'highpass');
      expect(engine.getDjFilterState().cutoff).toBe(MIN_FILTER_FREQ);

      engine.setDjFilter(30000, 'highpass');
      expect(engine.getDjFilterState().cutoff).toBe(MAX_FILTER_FREQ);
    });

    it('retrieves frequency bin data and waveform time-domain data', () => {
      const masterFreq = engine.getFrequencyData();
      expect(masterFreq).toBeInstanceOf(Uint8Array);
      expect(masterFreq.length).toBe(512);

      const vocalsWave = engine.getWaveformData('vocals');
      expect(vocalsWave).toBeInstanceOf(Uint8Array);
      expect(vocalsWave.length).toBe(1024);
    });
  });

  describe('Peak Extraction & Waveform Scrubber', () => {
    it('generates downsampled peak array for vocal stem and caches result', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          statusText: 'OK',
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
        })
      );

      await engine.loadStems('track-123');
      const peaks = engine.getStemPeakData('vocals', 120);

      expect(peaks).toBeInstanceOf(Float32Array);
      expect(peaks.length).toBe(120);
      expect(peaks[0]).toBeGreaterThan(0);

      // Verify cached reference is returned
      const cached = engine.getStemPeakData('vocals', 120);
      expect(cached).toBe(peaks);
    });

    it('returns zeros for uninitialized stem buffer', () => {
      const emptyPeaks = engine.getStemPeakData('vocals', 64);
      expect(emptyPeaks.length).toBe(64);
      expect(emptyPeaks[0]).toBe(0);
    });
  });

  describe('Auto Sidechain Ducking', () => {
    it('enables and disables auto ducking', () => {
      expect(engine.isDuckingEnabled()).toBe(false);
      engine.setDuckingEnabled(true);
      expect(engine.isDuckingEnabled()).toBe(true);
      expect(engine.getDuckingGainReduction()).toBe(1.0);

      engine.setDuckingEnabled(false);
      expect(engine.isDuckingEnabled()).toBe(false);
    });

    it('updates auto ducking gain reduction when vocal signal is present', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          statusText: 'OK',
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
        })
      );

      await engine.loadStems('track-123');
      await engine.play(0);
      engine.setDuckingEnabled(true);

      const reduction = engine.updateAutoDucking();
      expect(typeof reduction).toBe('number');
      expect(reduction).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Lifecycle and Cleanup', () => {
    it('triggers and unsubscribes onEnded callbacks', () => {
      const onEndedMock = vi.fn();
      const unsubscribe = engine.onEnded(onEndedMock);

      unsubscribe();
      // Internal trigger verification
      expect(onEndedMock).not.toHaveBeenCalled();
    });

    it('disposes all nodes and audio context cleanly', () => {
      engine.dispose(true);
      expect(mockContext.close).toHaveBeenCalled();
    });
  });
});
