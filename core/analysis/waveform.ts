/**
 * Waveform Multi-Resolution Peak Pyramid Generator
 * Generates hierarchical min/max peak pyramids (e.g. 128, 512, 2048, 8192 samples/bin)
 * Ensures smooth 60fps waveform rendering at any zoom level without scanning raw PCM buffers.
 */

export interface PeakData {
  min: Float32Array;
  max: Float32Array;
  length: number;
}

export interface PeakPyramid {
  resolutions: number[]; // e.g. [128, 512, 2048, 8192]
  levels: { [resolution: number]: PeakData };
}

export function generatePeakPyramid(
  audioBuffer: AudioBuffer,
  resolutions: number[] = [128, 512, 2048, 8192]
): PeakPyramid {
  const channelCount = audioBuffer.numberOfChannels;
  const bufferLength = audioBuffer.length;
  const channelData: Float32Array[] = [];

  for (let c = 0; c < channelCount; c++) {
    channelData.push(audioBuffer.getChannelData(c));
  }

  const levels: { [resolution: number]: PeakData } = {};

  for (const res of resolutions) {
    const binCount = Math.ceil(bufferLength / res);
    const minPeaks = new Float32Array(binCount);
    const maxPeaks = new Float32Array(binCount);

    for (let bin = 0; bin < binCount; bin++) {
      const startSample = bin * res;
      const endSample = Math.min(startSample + res, bufferLength);

      let min = 1.0;
      let max = -1.0;

      for (let s = startSample; s < endSample; s++) {
        // Average or maximum over channels
        for (let c = 0; c < channelCount; c++) {
          const val = channelData[c][s];
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }

      minPeaks[bin] = min === 1.0 ? 0 : min;
      maxPeaks[bin] = max === -1.0 ? 0 : max;
    }

    levels[res] = {
      min: minPeaks,
      max: maxPeaks,
      length: binCount,
    };
  }

  return {
    resolutions,
    levels,
  };
}

/**
 * Given a visible time range (seconds) and target pixel width, selects the optimal pyramid level.
 */
export function selectPyramidLevel(
  pyramid: PeakPyramid,
  durationSeconds: number,
  sampleRate: number,
  canvasPixelWidth: number
): { resolution: number; data: PeakData } {
  const totalSamples = durationSeconds * sampleRate;
  const samplesPerPixel = totalSamples / Math.max(canvasPixelWidth, 1);

  // Find the closest resolution that is <= samplesPerPixel (or lowest available)
  let chosenRes = pyramid.resolutions[0];
  for (const res of pyramid.resolutions) {
    if (res <= samplesPerPixel) {
      chosenRes = res;
    } else {
      break;
    }
  }

  return {
    resolution: chosenRes,
    data: pyramid.levels[chosenRes] || pyramid.levels[pyramid.resolutions[0]],
  };
}
