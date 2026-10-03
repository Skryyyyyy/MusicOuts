import { describe, it, expect } from 'vitest';
import { detectBpmAndBeats } from '../core/analysis/bpm';
import { detectSongSections } from '../core/analysis/sections';

describe('Audio Analysis: BPM & Sections', () => {
  it('detects BPM from rhythmic pulse buffer', () => {
    const sampleRate = 44100;
    const duration = 10;
    const length = sampleRate * duration;
    const channel0 = new Float32Array(length);

    // Create 120 BPM pulses (every 0.5s)
    const samplesPerBeat = Math.floor(sampleRate * 0.5);
    for (let b = 0; b < duration * 2; b++) {
      const start = b * samplesPerBeat;
      for (let i = 0; i < 500; i++) {
        if (start + i < length) {
          channel0[start + i] = (Math.random() * 2 - 1) * Math.exp(-i / 100);
        }
      }
    }

    const mockBuffer = {
      sampleRate,
      length,
      duration,
      numberOfChannels: 1,
      getChannelData: () => channel0,
    } as unknown as AudioBuffer;

    const result = detectBpmAndBeats(mockBuffer);
    expect(result.bpm).toBeGreaterThanOrEqual(110);
    expect(result.bpm).toBeLessThanOrEqual(130);
    expect(result.beatGrid.length).toBeGreaterThan(0);
  });

  it('detects song sections based on phrase energies', () => {
    const sampleRate = 44100;
    const duration = 32;
    const length = sampleRate * duration;
    const channel0 = new Float32Array(length);

    // Fill with varied energy levels
    for (let i = 0; i < length; i++) {
      channel0[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * (i > length / 2 ? 0.8 : 0.2);
    }

    const mockBuffer = {
      sampleRate,
      length,
      duration,
      numberOfChannels: 1,
      getChannelData: () => channel0,
    } as unknown as AudioBuffer;

    const sections = detectSongSections(mockBuffer, 120);
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].name).toBe('Intro');
    expect(sections[sections.length - 1].name).toBe('Outro');
  });
});
