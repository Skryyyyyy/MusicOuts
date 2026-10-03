import { SourceAsset, Track, Clip, Project, SongSection } from '../project-model/types';
import { generatePeakPyramid } from '../analysis/waveform';

/**
 * Creates the exact 7-track project matching the Neon Dark DAW screenshot:
 * 1. Drums (Electric Blue)
 * 2. Bass (Neon Green)
 * 3. Guitar (Neon Purple)
 * 4. Vocals (Hot Pink)
 * 5. Synth Pad (Warm Amber)
 * 6. FX (Teal/Cyan)
 * 7. Music (Deep Indigo)
 */
export function createDemoProject(audioCtx: AudioContext): {
  project: Project;
  buffers: Map<string, AudioBuffer>;
} {
  const sampleRate = audioCtx.sampleRate || 44100;
  const duration = 100.0; // 100 seconds to cover 0:00 to 1:40
  const bpm = 120;
  const lengthSamples = Math.floor(sampleRate * duration);

  const buffers = new Map<string, AudioBuffer>();

  function createStereoBuffer() {
    return audioCtx.createBuffer(2, lengthSamples, sampleRate);
  }

  // 1. Drums Buffer (Blue)
  const drumsBuffer = createStereoBuffer();
  const dL = drumsBuffer.getChannelData(0);
  const dR = drumsBuffer.getChannelData(1);
  const secondsPerBeat = 60 / bpm;
  const totalBeats = Math.floor(duration / secondsPerBeat);

  for (let beat = 0; beat < totalBeats; beat++) {
    const beatTime = beat * secondsPerBeat;
    const startSample = Math.floor(beatTime * sampleRate);
    const isKick = beat % 2 === 0;

    if (isKick) {
      for (let i = 0; i < sampleRate * 0.25; i++) {
        const s = startSample + i;
        if (s < lengthSamples) {
          const t = i / sampleRate;
          const val = Math.sin(2 * Math.PI * (120 * Math.exp(-t * 24)) * t) * Math.exp(-t * 14) * 0.9;
          dL[s] += val;
          dR[s] += val;
        }
      }
    } else {
      for (let i = 0; i < sampleRate * 0.2; i++) {
        const s = startSample + i;
        if (s < lengthSamples) {
          const t = i / sampleRate;
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 22) * 0.45;
          dL[s] += noise;
          dR[s] += noise;
        }
      }
    }

    for (let sub = 0; sub < 4; sub++) {
      const hatSample = Math.floor((beatTime + sub * (secondsPerBeat / 4)) * sampleRate);
      for (let i = 0; i < sampleRate * 0.04; i++) {
        const s = hatSample + i;
        if (s < lengthSamples) {
          const t = i / sampleRate;
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 60) * 0.12;
          dL[s] += noise;
          dR[s] += noise;
        }
      }
    }
  }

  // 2. Bass Buffer (Green)
  const bassBuffer = createStereoBuffer();
  const bL = bassBuffer.getChannelData(0);
  const bR = bassBuffer.getChannelData(1);
  const bassNotes = [55, 55, 49, 49, 43.65, 43.65, 49, 51.91];

  for (let beat = 0; beat < totalBeats; beat++) {
    const noteFreq = bassNotes[Math.floor(beat / 2) % bassNotes.length];
    const startSample = Math.floor(beat * secondsPerBeat * sampleRate);
    const noteLen = Math.floor(secondsPerBeat * 0.85 * sampleRate);

    for (let i = 0; i < noteLen; i++) {
      const s = startSample + i;
      if (s < lengthSamples) {
        const t = i / sampleRate;
        const env = Math.min(1, i / (sampleRate * 0.01)) * Math.exp(-t * 2.5);
        const val = Math.sin(2 * Math.PI * noteFreq * t) * env * 0.7;
        bL[s] += val;
        bR[s] += val;
      }
    }
  }

  // 3. Guitar Buffer (Purple)
  const guitarBuffer = createStereoBuffer();
  const gL = guitarBuffer.getChannelData(0);
  const gR = guitarBuffer.getChannelData(1);
  const guitarChords = [220, 277.18, 329.63, 440];

  for (let beat = 0; beat < totalBeats; beat += 2) {
    const startSample = Math.floor(beat * secondsPerBeat * sampleRate);
    for (let i = 0; i < sampleRate * 0.9; i++) {
      const s = startSample + i;
      if (s < lengthSamples) {
        const t = i / sampleRate;
        let sum = 0;
        guitarChords.forEach((freq, idx) => {
          sum += Math.sin(2 * Math.PI * freq * t + idx) * Math.exp(-t * 3.0) * 0.15;
        });
        gL[s] += sum;
        gR[s] += sum;
      }
    }
  }

  // 4. Vocals Buffer (Pink)
  const vocalBuffer = createStereoBuffer();
  const vL = vocalBuffer.getChannelData(0);
  const vR = vocalBuffer.getChannelData(1);
  const vocalNotes = [440, 493.88, 523.25, 587.33, 659.25, 523.25];

  for (let beat = 0; beat < totalBeats; beat++) {
    if (beat % 4 !== 3) {
      const noteFreq = vocalNotes[beat % vocalNotes.length];
      const startSample = Math.floor(beat * secondsPerBeat * sampleRate);
      for (let i = 0; i < sampleRate * 0.7; i++) {
        const s = startSample + i;
        if (s < lengthSamples) {
          const t = i / sampleRate;
          const vib = 1 + 0.015 * Math.sin(2 * Math.PI * 5.5 * t);
          const val = Math.sin(2 * Math.PI * (noteFreq * vib) * t) * Math.sin((i / (sampleRate * 0.7)) * Math.PI) * 0.35;
          vL[s] += val;
          vR[s] += val;
        }
      }
    }
  }

  // 5. Synth Pad Buffer (Amber)
  const synthBuffer = createStereoBuffer();
  const sL = synthBuffer.getChannelData(0);
  const sR = synthBuffer.getChannelData(1);

  for (let bar = 0; bar < totalBeats / 4; bar++) {
    const startSample = Math.floor(bar * 4 * secondsPerBeat * sampleRate);
    const barLen = Math.floor(4 * secondsPerBeat * sampleRate);
    for (let i = 0; i < barLen; i++) {
      const s = startSample + i;
      if (s < lengthSamples) {
        const t = i / sampleRate;
        const env = Math.sin((i / barLen) * Math.PI) * 0.3;
        sL[s] += Math.sin(2 * Math.PI * 220 * t) * env;
        sR[s] += Math.sin(2 * Math.PI * 220.8 * t) * env;
      }
    }
  }

  // 6. FX Buffer (Teal)
  const fxBuffer = createStereoBuffer();
  const fL = fxBuffer.getChannelData(0);
  const fR = fxBuffer.getChannelData(1);

  for (let i = 0; i < lengthSamples; i++) {
    if ((i % (sampleRate * 16)) < sampleRate * 3) {
      const t = (i % (sampleRate * 16)) / sampleRate;
      const val = (Math.random() * 2 - 1) * Math.sin(t * Math.PI / 3) * 0.25;
      fL[i] += val;
      fR[i] += val;
    }
  }

  // 7. Background Music Buffer (Indigo)
  const musicBuffer = createStereoBuffer();
  const mL = musicBuffer.getChannelData(0);
  const mR = musicBuffer.getChannelData(1);

  for (let i = 0; i < lengthSamples; i++) {
    mL[i] = (dL[i] * 0.4 + bL[i] * 0.4 + sL[i] * 0.4);
    mR[i] = (dR[i] * 0.4 + bR[i] * 0.4 + sR[i] * 0.4);
  }

  buffers.set('src-drums', drumsBuffer);
  buffers.set('src-bass', bassBuffer);
  buffers.set('src-guitar', guitarBuffer);
  buffers.set('src-vocals', vocalBuffer);
  buffers.set('src-synth', synthBuffer);
  buffers.set('src-fx', fxBuffer);
  buffers.set('src-music', musicBuffer);

  const sources: Record<string, SourceAsset> = {
    'src-drums': {
      id: 'src-drums',
      name: 'Drum Loop 01.wav',
      duration: 100,
      sampleRate,
      channels: 2,
      fileSize: 17640000,
      bpm: 120,
      key: 'C Major',
      stemType: 'drums',
      peakPyramids: generatePeakPyramid(drumsBuffer).levels,
    },
    'src-bass': {
      id: 'src-bass',
      name: 'Bass Line.wav',
      duration: 100,
      sampleRate,
      channels: 2,
      fileSize: 17640000,
      bpm: 120,
      key: 'C Major',
      stemType: 'bass',
      peakPyramids: generatePeakPyramid(bassBuffer).levels,
    },
    'src-guitar': {
      id: 'src-guitar',
      name: 'Guitar Riff.wav',
      duration: 100,
      sampleRate,
      channels: 2,
      fileSize: 17640000,
      bpm: 120,
      key: 'C Major',
      stemType: 'guitar',
      peakPyramids: generatePeakPyramid(guitarBuffer).levels,
    },
    'src-vocals': {
      id: 'src-vocals',
      name: 'Vocal Take 01.wav',
      duration: 100,
      sampleRate,
      channels: 2,
      fileSize: 17640000,
      bpm: 120,
      key: 'C Major',
      stemType: 'vocals',
      peakPyramids: generatePeakPyramid(vocalBuffer).levels,
    },
    'src-synth': {
      id: 'src-synth',
      name: 'Synth Pad.wav',
      duration: 100,
      sampleRate,
      channels: 2,
      fileSize: 17640000,
      bpm: 120,
      key: 'C Major',
      stemType: 'other',
      peakPyramids: generatePeakPyramid(synthBuffer).levels,
    },
    'src-fx': {
      id: 'src-fx',
      name: 'FX Rise.wav',
      duration: 100,
      sampleRate,
      channels: 2,
      fileSize: 17640000,
      bpm: 120,
      key: 'C Major',
      stemType: 'other',
      peakPyramids: generatePeakPyramid(fxBuffer).levels,
    },
    'src-music': {
      id: 'src-music',
      name: 'Background Music.wav',
      duration: 100,
      sampleRate,
      channels: 2,
      fileSize: 17640000,
      bpm: 120,
      key: 'C Major',
      stemType: 'mix',
      peakPyramids: generatePeakPyramid(musicBuffer).levels,
    },
  };

  // 7 Tracks matching the exact screenshot
  const tracks: Track[] = [
    {
      id: 'track-1',
      name: 'Drums',
      stemType: 'drums',
      color: '#1E88E5', // Electric Blue
      volume: 1.0,
      pan: 0,
      isMuted: false,
      isSoloed: false,
      eqLowGain: 2.0,
      eqMidGain: 0,
      eqHighGain: 1.5,
      reverbSend: 0.1,
      automationLanes: [],
    },
    {
      id: 'track-2',
      name: 'Bass',
      stemType: 'bass',
      color: '#00C853', // Neon Green
      volume: 0.95,
      pan: 0,
      isMuted: false,
      isSoloed: false,
      eqLowGain: 3.0,
      eqMidGain: -1.0,
      eqHighGain: -3.0,
      reverbSend: 0.0,
      automationLanes: [],
    },
    {
      id: 'track-3',
      name: 'Guitar',
      stemType: 'guitar',
      color: '#8B5CF6', // Neon Purple
      volume: 0.85,
      pan: -0.2,
      isMuted: false,
      isSoloed: false,
      eqLowGain: -1.0,
      eqMidGain: 1.0,
      eqHighGain: 1.0,
      reverbSend: 0.2,
      automationLanes: [],
    },
    {
      id: 'track-4',
      name: 'Vocals',
      stemType: 'vocals',
      color: '#EC4899', // Hot Pink
      volume: 1.0,
      pan: 0,
      isMuted: false,
      isSoloed: false,
      eqLowGain: -2.0,
      eqMidGain: 2.0,
      eqHighGain: 2.5,
      reverbSend: 0.35,
      automationLanes: [],
    },
    {
      id: 'track-5',
      name: 'Synth Pad',
      stemType: 'other',
      color: '#EAB308', // Warm Amber / Yellow
      volume: 0.8,
      pan: 0.2,
      isMuted: false,
      isSoloed: false,
      eqLowGain: 0,
      eqMidGain: 0,
      eqHighGain: 1.0,
      reverbSend: 0.4,
      automationLanes: [],
    },
    {
      id: 'track-6',
      name: 'FX',
      stemType: 'other',
      color: '#06B6D4', // Teal / Cyan
      volume: 0.75,
      pan: 0.3,
      isMuted: false,
      isSoloed: false,
      eqLowGain: -3.0,
      eqMidGain: 0,
      eqHighGain: 3.0,
      reverbSend: 0.5,
      automationLanes: [],
    },
    {
      id: 'track-7',
      name: 'Music',
      stemType: 'mix',
      color: '#6366F1', // Deep Indigo
      volume: 0.9,
      pan: 0,
      isMuted: false,
      isSoloed: false,
      eqLowGain: 0,
      eqMidGain: 0,
      eqHighGain: 0,
      reverbSend: 0.15,
      automationLanes: [],
    },
  ];

  // Exact clips positioned as in the screenshot
  const clips: Clip[] = [
    // Track 1: Drums
    {
      id: 'clip-drums-1',
      name: 'Drum Loop 01',
      trackId: 'track-1',
      sourceId: 'src-drums',
      sourceIn: 0,
      sourceOut: 20,
      startTime: 2,
      gain: 1.0,
      pan: 0,
      isMuted: false,
      color: '#1E88E5',
      automationLanes: [],
    },
    {
      id: 'clip-drums-2',
      name: 'Drum Loop 01',
      trackId: 'track-1',
      sourceId: 'src-drums',
      sourceIn: 0,
      sourceOut: 45,
      startTime: 24,
      gain: 1.0,
      pan: 0,
      isMuted: false,
      color: '#1E88E5',
      automationLanes: [],
    },
    // Track 2: Bass
    {
      id: 'clip-bass-1',
      name: 'Bass Line',
      trackId: 'track-2',
      sourceId: 'src-bass',
      sourceIn: 0,
      sourceOut: 26,
      startTime: 6,
      gain: 0.95,
      pan: 0,
      isMuted: false,
      color: '#00C853',
      automationLanes: [],
    },
    {
      id: 'clip-bass-2',
      name: 'Bass Line',
      trackId: 'track-2',
      sourceId: 'src-bass',
      sourceIn: 26,
      sourceOut: 52,
      startTime: 33,
      gain: 0.95,
      pan: 0,
      isMuted: false,
      color: '#00C853',
      automationLanes: [],
    },
    // Track 3: Guitar
    {
      id: 'clip-guitar-1',
      name: 'Guitar Riff',
      trackId: 'track-3',
      sourceId: 'src-guitar',
      sourceIn: 0,
      sourceOut: 36,
      startTime: 4,
      gain: 0.85,
      pan: -0.2,
      isMuted: false,
      color: '#8B5CF6',
      automationLanes: [],
    },
    {
      id: 'clip-guitar-2',
      name: 'Guitar Riff',
      trackId: 'track-3',
      sourceId: 'src-guitar',
      sourceIn: 0,
      sourceOut: 12,
      startTime: 50,
      gain: 0.85,
      pan: -0.2,
      isMuted: false,
      color: '#8B5CF6',
      automationLanes: [],
    },
    // Track 4: Vocals
    {
      id: 'clip-voc-1',
      name: 'Vocal Take 01',
      trackId: 'track-4',
      sourceId: 'src-vocals',
      sourceIn: 0,
      sourceOut: 22,
      startTime: 11,
      gain: 1.0,
      pan: 0,
      fadeIn: { duration: 0.5, curve: 'linear' },
      fadeOut: { duration: 0.8, curve: 'linear' },
      isMuted: false,
      color: '#EC4899',
      automationLanes: [],
    },
    {
      id: 'clip-voc-2',
      name: 'Vocal Take 01',
      trackId: 'track-4',
      sourceId: 'src-vocals',
      sourceIn: 22,
      sourceOut: 48,
      startTime: 37,
      gain: 1.0,
      pan: 0,
      fadeIn: { duration: 0.5, curve: 'linear' },
      fadeOut: { duration: 0.8, curve: 'linear' },
      isMuted: false,
      color: '#EC4899',
      automationLanes: [],
    },
    // Track 5: Synth Pad
    {
      id: 'clip-synth-1',
      name: 'Synth Pad',
      trackId: 'track-5',
      sourceId: 'src-synth',
      sourceIn: 0,
      sourceOut: 55,
      startTime: 3,
      gain: 0.8,
      pan: 0.2,
      isMuted: false,
      color: '#EAB308',
      automationLanes: [],
    },
    // Track 6: FX
    {
      id: 'clip-fx-1',
      name: 'Whoosh',
      trackId: 'track-6',
      sourceId: 'src-fx',
      sourceIn: 0,
      sourceOut: 10,
      startTime: 3,
      gain: 0.75,
      pan: 0.3,
      isMuted: false,
      color: '#06B6D4',
      automationLanes: [],
    },
    {
      id: 'clip-fx-2',
      name: 'Impact',
      trackId: 'track-6',
      sourceId: 'src-fx',
      sourceIn: 0,
      sourceOut: 10,
      startTime: 29,
      gain: 0.75,
      pan: 0.3,
      isMuted: false,
      color: '#06B6D4',
      automationLanes: [],
    },
    {
      id: 'clip-fx-3',
      name: 'FX Rise',
      trackId: 'track-6',
      sourceId: 'src-fx',
      sourceIn: 0,
      sourceOut: 10,
      startTime: 47,
      gain: 0.75,
      pan: 0.3,
      isMuted: false,
      color: '#06B6D4',
      automationLanes: [],
    },
    // Track 7: Music
    {
      id: 'clip-music-1',
      name: 'Background Music',
      trackId: 'track-7',
      sourceId: 'src-music',
      sourceIn: 0,
      sourceOut: 65,
      startTime: 0,
      gain: 0.9,
      pan: 0,
      isMuted: false,
      color: '#6366F1',
      automationLanes: [],
    },
  ];

  const sections: SongSection[] = [
    { id: 'sec-1', name: 'Intro', startTime: 0, endTime: 12, color: '#1E88E5' },
    { id: 'sec-2', name: 'Verse 1', startTime: 12, endTime: 30, color: '#EC4899' },
    { id: 'sec-3', name: 'Chorus', startTime: 30, endTime: 48, color: '#EAB308' },
    { id: 'sec-4', name: 'Outro', startTime: 48, endTime: 70, color: '#6366F1' },
  ];

  const project: Project = {
    schemaVersion: 1,
    id: 'proj-neon-studio',
    name: 'My Project',
    bpm: 120,
    timeSignature: [4, 4],
    sampleRate,
    duration: 100.0,
    sources,
    tracks,
    clips,
    markers: [],
    sections,
    masterVolume: 1.0,
    masterLimiterCeiling: -0.1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return { project, buffers };
}

/**
 * Creates a clean blank project for starting a fresh production session
 */
export function createEmptyProject(): Project {
  return {
    schemaVersion: 1,
    id: `proj-${Date.now()}`,
    name: 'Untitled Session 01',
    bpm: 120,
    timeSignature: [4, 4],
    sampleRate: 48000,
    duration: 100.0,
    sources: {},
    tracks: [
      {
        id: `track-${Date.now()}-1`,
        name: 'Audio Track 01',
        stemType: 'other',
        color: '#00E5FF',
        volume: 1.0,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        eqLowGain: 0,
        eqMidGain: 0,
        eqHighGain: 0,
        reverbSend: 0.1,
        automationLanes: [],
      },
    ],
    clips: [],
    markers: [],
    sections: [],
    masterVolume: 1.0,
    masterLimiterCeiling: -0.1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

