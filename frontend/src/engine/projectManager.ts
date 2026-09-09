import { MusicOutsProject, DEFAULT_FX_RACK_STATE } from '../types';

export const LATEST_PROJECT_STORAGE_KEY = 'musicouts_current_project';

/**
 * Saves project to browser local storage and triggers .musicouts file download
 */
export function saveProjectToFile(project: MusicOutsProject, filename?: string): void {
  try {
    localStorage.setItem(LATEST_PROJECT_STORAGE_KEY, JSON.stringify(project));
  } catch (err) {
    console.warn('Failed to save project to localStorage:', err);
  }

  const jsonStr = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (filename || project.title || 'Untitled_Project')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = url;
  a.download = `${safeName}.musicouts`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Loads and validates a .musicouts project file from user disk
 */
export async function loadProjectFromFile(file: File): Promise<MusicOutsProject> {
  const text = await file.text();
  let parsed: Partial<MusicOutsProject>;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid project file: Not a valid JSON document.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid project format.');
  }

  const validated: MusicOutsProject = {
    version: parsed.version || '1.1',
    title: parsed.title || file.name.replace(/\.musicouts$/i, ''),
    trackId: parsed.trackId || '',
    duration: parsed.duration || 0,
    bpm: parsed.bpm || 120,
    key: parsed.key || 'C Major',
    timeSignature: parsed.timeSignature || '4/4',
    mode: parsed.mode || 'producer',
    stemStates: parsed.stemStates || {
      vocals: { volume: 1.0, muted: false, solo: false, pan: 0 },
      drums: { volume: 1.0, muted: false, solo: false, pan: 0 },
      bass: { volume: 1.0, muted: false, solo: false, pan: 0 },
      other: { volume: 1.0, muted: false, solo: false, pan: 0 },
    },
    fxRack: parsed.fxRack || DEFAULT_FX_RACK_STATE,
    masterVolume: parsed.masterVolume ?? 1.0,
    djFilterCutoff: parsed.djFilterCutoff ?? 20000,
    djFilterType: parsed.djFilterType ?? 'lowpass',
    isDucking: parsed.isDucking ?? false,
    markers: parsed.markers || [],
    automation: parsed.automation || [],
    scenes: parsed.scenes || [],
    created: parsed.created || new Date().toISOString(),
  };

  return validated;
}

/**
 * Retrieves the last auto-saved project from local storage
 */
export function getSavedProjectFromStorage(): MusicOutsProject | null {
  try {
    const raw = localStorage.getItem(LATEST_PROJECT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
