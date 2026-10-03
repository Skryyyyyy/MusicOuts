import { SongSection } from '../project-model/types';

/**
 * Automatic Song Structure & Section Segmenter
 * Divides songs into musical sections (Intro, Verse, Chorus, Drop, Outro)
 * by evaluating RMS energy tiers and musical phrase boundaries (8/16 bars).
 */

export function detectSongSections(audioBuffer: AudioBuffer, bpm: number = 120): SongSection[] {
  const duration = audioBuffer.duration;
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  const secondsPerBar = (60 / bpm) * 4;
  const numBars = Math.floor(duration / secondsPerBar);

  if (numBars < 2) {
    return [
      { id: 'sec-full', name: 'Full Track', startTime: 0, endTime: duration, color: '#38BDF8' },
    ];
  }

  // Calculate RMS energy per 4-bar or 8-bar musical phrase
  const phraseBars = numBars >= 16 ? 8 : 4;
  const phraseDuration = phraseBars * secondsPerBar;
  const numPhrases = Math.ceil(duration / phraseDuration);

  const phraseEnergies: number[] = [];

  for (let p = 0; p < numPhrases; p++) {
    const startSample = Math.floor(p * phraseDuration * sampleRate);
    const endSample = Math.min(channelData.length, Math.floor((p + 1) * phraseDuration * sampleRate));
    let sumSquares = 0;
    const step = 8; // Step for speed

    for (let s = startSample; s < endSample; s += step) {
      const val = channelData[s];
      sumSquares += val * val;
    }

    const count = (endSample - startSample) / step;
    const rms = Math.sqrt(sumSquares / Math.max(1, count));
    phraseEnergies.push(rms);
  }

  // Normalize energies
  const maxEnergy = Math.max(...phraseEnergies, 0.001);
  const normalized = phraseEnergies.map((e) => e / maxEnergy);

  const sections: SongSection[] = [];
  const colors = {
    Intro: '#38BDF8', // Cyan
    Verse: '#818CF8', // Indigo
    Chorus: '#F472B6', // Pink
    Drop: '#FB923C', // Orange
    Bridge: '#A78BFA', // Purple
    Outro: '#94A3B8', // Slate
  };

  for (let p = 0; p < numPhrases; p++) {
    const startTime = parseFloat((p * phraseDuration).toFixed(2));
    const endTime = parseFloat(Math.min(duration, (p + 1) * phraseDuration).toFixed(2));
    const energy = normalized[p];

    let sectionName: 'Intro' | 'Verse' | 'Chorus' | 'Drop' | 'Bridge' | 'Outro';

    if (p === 0) {
      sectionName = 'Intro';
    } else if (p === numPhrases - 1) {
      sectionName = 'Outro';
    } else if (energy > 0.8) {
      sectionName = 'Drop';
    } else if (energy > 0.55) {
      sectionName = 'Chorus';
    } else if (energy > 0.3) {
      sectionName = 'Verse';
    } else {
      sectionName = 'Bridge';
    }

    sections.push({
      id: `sec-${p + 1}`,
      name: sectionName,
      startTime,
      endTime,
      color: colors[sectionName] || '#38BDF8',
    });
  }

  return sections;
}
