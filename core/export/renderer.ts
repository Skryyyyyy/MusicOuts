import { Project } from '../project-model/types';
import { evaluateKeyframe } from '../dsp/keyframes';

/**
 * Offline Audio Graph Renderer
 * Uses OfflineAudioContext with exact topological parity to AudioEngine
 * for bit-perfect WAV/FLAC offline export.
 */
export async function renderProjectToBuffer(
  project: Project,
  audioBuffers: Map<string, AudioBuffer>,
  startSeconds: number = 0,
  durationSeconds?: number
): Promise<AudioBuffer> {
  const sampleRate = project.sampleRate || 44100;
  const totalDuration = durationSeconds || project.duration || 60;
  const lengthSamples = Math.ceil(totalDuration * sampleRate);

  const offlineCtx = new OfflineAudioContext(2, lengthSamples, sampleRate);

  // Master EQ
  const masterEqLow = offlineCtx.createBiquadFilter();
  masterEqLow.type = 'lowshelf';
  masterEqLow.frequency.value = 120;
  masterEqLow.gain.value = 0;

  const masterEqMid = offlineCtx.createBiquadFilter();
  masterEqMid.type = 'peaking';
  masterEqMid.frequency.value = 2500;
  masterEqMid.Q.value = 1.0;
  masterEqMid.gain.value = 0;

  const masterEqHigh = offlineCtx.createBiquadFilter();
  masterEqHigh.type = 'highshelf';
  masterEqHigh.frequency.value = 8000;
  masterEqHigh.gain.value = 0;

  // Master Compressor
  const masterCompressor = offlineCtx.createDynamicsCompressor();
  masterCompressor.threshold.value = -12;
  masterCompressor.ratio.value = 3;

  // Master Gain
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = project.masterVolume;

  masterEqLow.connect(masterEqMid);
  masterEqMid.connect(masterEqHigh);
  masterEqHigh.connect(masterCompressor);
  masterCompressor.connect(masterGain);
  masterGain.connect(offlineCtx.destination);

  // Track map
  const trackNodes: Map<string, GainNode> = new Map();
  const hasSolo = project.tracks.some((t) => t.isSoloed);

  project.tracks.forEach((track) => {
    const inputGain = offlineCtx.createGain();
    const panner = offlineCtx.createStereoPanner();
    const volGain = offlineCtx.createGain();

    const effectiveMute = track.isMuted || (hasSolo && !track.isSoloed);
    volGain.gain.value = effectiveMute ? 0 : track.volume;
    panner.pan.value = track.pan;

    inputGain.connect(panner);
    panner.connect(volGain);
    volGain.connect(masterEqLow);

    trackNodes.set(track.id, inputGain);
  });

  // Schedule clips
  project.clips.forEach((clip) => {
    const clipDuration = clip.sourceOut - clip.sourceIn;
    const clipEnd = clip.startTime + clipDuration;

    if (clipEnd <= startSeconds || clip.startTime >= startSeconds + totalDuration) {
      return;
    }

    const buffer = audioBuffers.get(clip.sourceId);
    if (!buffer) return;

    const trackInput = trackNodes.get(clip.trackId);
    if (!trackInput) return;

    const src = offlineCtx.createBufferSource();
    src.buffer = buffer;

    const clipGain = offlineCtx.createGain();
    const clipPan = offlineCtx.createStereoPanner();

    clipGain.gain.value = clip.isMuted ? 0 : clip.gain;
    clipPan.pan.value = clip.pan;

    // Apply keyframe volume if present
    const volLane = clip.automationLanes.find((l) => l.parameter === 'volume');
    if (volLane && volLane.points.length > 0) {
      clipGain.gain.value = evaluateKeyframe(volLane, 0);
    }

    src.connect(clipGain);
    clipGain.connect(clipPan);
    clipPan.connect(trackInput);

    const relativeStart = Math.max(0, clip.startTime - startSeconds);
    const sourceOffset = clip.startTime < startSeconds ? clip.sourceIn + (startSeconds - clip.startTime) : clip.sourceIn;
    const renderDur = Math.min(clipDuration, startSeconds + totalDuration - clip.startTime);

    // Apply fades
    if (clip.fadeIn && clip.fadeIn.duration > 0) {
      clipGain.gain.setValueAtTime(0.001, relativeStart);
      clipGain.gain.exponentialRampToValueAtTime(clip.gain || 1.0, relativeStart + clip.fadeIn.duration);
    }
    if (clip.fadeOut && clip.fadeOut.duration > 0) {
      const fadeStart = relativeStart + renderDur - clip.fadeOut.duration;
      clipGain.gain.setValueAtTime(clip.gain || 1.0, Math.max(relativeStart, fadeStart));
      clipGain.gain.exponentialRampToValueAtTime(0.0001, relativeStart + renderDur);
    }

    src.start(relativeStart, sourceOffset, renderDur);
  });

  return await offlineCtx.startRendering();
}

/**
 * Encodes an AudioBuffer into standard 16-bit PCM WAV format
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF identifier
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  // format chunk identifier
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave and write 16-bit PCM
  let offset = 44;
  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Render project to WAV Blob
 */
export async function renderOfflineWav(
  project: Project,
  audioBuffers: Map<string, AudioBuffer>,
  durationSeconds?: number,
  _sampleRate?: number
): Promise<Blob> {
  const renderedBuffer = await renderProjectToBuffer(project, audioBuffers, 0, durationSeconds);
  return audioBufferToWavBlob(renderedBuffer);
}

/**
 * Trigger file download in browser
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

