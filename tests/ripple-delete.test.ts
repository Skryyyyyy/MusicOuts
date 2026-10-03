import { describe, it, expect } from 'vitest';
import { Project, Clip, Track } from '../core/project-model/types';
import { CommandManager, RippleDeleteClipCommand } from '../core/project-model/commands';

describe('Ripple Delete Command', () => {
  const track: Track = {
    id: 't-1',
    name: 'Drums',
    stemType: 'drums',
    color: '#F59E0B',
    volume: 1,
    pan: 0,
    isMuted: false,
    isSoloed: false,
    eqLowGain: 0,
    eqMidGain: 0,
    eqHighGain: 0,
    reverbSend: 0,
    automationLanes: [],
  };

  const clip1: Clip = {
    id: 'c-1',
    name: 'Clip 1',
    trackId: 't-1',
    sourceId: 's-1',
    sourceIn: 0,
    sourceOut: 4,
    startTime: 0,
    gain: 1,
    pan: 0,
    isMuted: false,
    automationLanes: [],
  };

  const clip2: Clip = {
    id: 'c-2',
    name: 'Clip 2',
    trackId: 't-1',
    sourceId: 's-1',
    sourceIn: 0,
    sourceOut: 4,
    startTime: 4,
    gain: 1,
    pan: 0,
    isMuted: false,
    automationLanes: [],
  };

  const clip3: Clip = {
    id: 'c-3',
    name: 'Clip 3',
    trackId: 't-1',
    sourceId: 's-1',
    sourceIn: 0,
    sourceOut: 4,
    startTime: 8,
    gain: 1,
    pan: 0,
    isMuted: false,
    automationLanes: [],
  };

  const project: Project = {
    schemaVersion: 1,
    id: 'p-1',
    name: 'Test Project',
    bpm: 120,
    timeSignature: [4, 4],
    sampleRate: 44100,
    duration: 30,
    sources: {},
    tracks: [track],
    clips: [clip1, clip2, clip3],
    markers: [],
    sections: [],
    masterVolume: 1,
    masterLimiterCeiling: -0.1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('deletes clip2 and shifts clip3 left by 4 seconds (ripple)', () => {
    const cmdManager = new CommandManager();
    const rippleCmd = new RippleDeleteClipCommand('c-2');

    const updated = cmdManager.execute(rippleCmd, project);
    expect(updated.clips.length).toBe(2);

    const remainingClip3 = updated.clips.find((c) => c.id === 'c-3')!;
    expect(remainingClip3.startTime).toBe(4); // Shifted from 8 to 4

    // Test Undo
    const undone = cmdManager.undo(updated);
    expect(undone.clips.length).toBe(3);
    const restoredClip3 = undone.clips.find((c) => c.id === 'c-3')!;
    expect(restoredClip3.startTime).toBe(8);
  });
});
