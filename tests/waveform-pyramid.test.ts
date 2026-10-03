import { describe, it, expect } from 'vitest';
import { generatePeakPyramid, selectPyramidLevel } from '../core/analysis/waveform';

describe('Waveform Peak Pyramid Generation', () => {
  it('builds multi-resolution peak pyramids correctly', () => {
    // Mock AudioBuffer structure
    const sampleRate = 44100;
    const duration = 2.0;
    const length = sampleRate * duration;
    const channel0 = new Float32Array(length);

    // Generate sinusoidal wave
    for (let i = 0; i < length; i++) {
      channel0[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }

    const mockBuffer = {
      sampleRate,
      length,
      duration,
      numberOfChannels: 1,
      getChannelData: () => channel0,
    } as unknown as AudioBuffer;

    const pyramid = generatePeakPyramid(mockBuffer, [128, 512, 2048]);
    expect(pyramid.resolutions).toEqual([128, 512, 2048]);

    const level128 = pyramid.levels[128];
    expect(level128.length).toBe(Math.ceil(length / 128));
    expect(level128.max[0]).toBeGreaterThan(0.5);
    expect(level128.min[0]).toBeLessThan(-0.5);

    const level2048 = pyramid.levels[2048];
    expect(level2048.length).toBe(Math.ceil(length / 2048));

    // Test pyramid level selection for 800px width
    const selection = selectPyramidLevel(pyramid, duration, sampleRate, 800);
    expect(selection.resolution).toBeDefined();
    expect(selection.data.length).toBeGreaterThan(0);
  });
});
