import { describe, it, expect } from 'vitest';
import { Project, Clip, Track } from '../core/project-model/types';
import {
  CommandManager,
  SplitClipCommand,
  MoveClipCommand,
  TrimClipCommand,
  SetClipFadeCommand,
} from '../core/project-model/commands';

describe('Project Model EDL & Command Manager', () => {
  const initialTrack: Track = {
    id: 'track-1',
    name: 'Lead Vocals',
    stemType: 'vocals',
    color: '#06B6D4',
    volume: 1.0,
    pan: 0,
    isMuted: false,
    isSoloed: false,
    eqLowGain: 0,
    eqMidGain: 0,
    eqHighGain: 0,
    reverbSend: 0.2,
    automationLanes: [],
  };

  const initialClip: Clip = {
    id: 'clip-1',
    name: 'Verse Vocal',
    trackId: 'track-1',
    sourceId: 'src-1',
    sourceIn: 0,
    sourceOut: 10,
    startTime: 5,
    gain: 1.0,
    pan: 0,
    isMuted: false,
    automationLanes: [],
  };

  const initialProject: Project = {
    schemaVersion: 1,
    id: 'test-proj',
    name: 'Test Project',
    bpm: 120,
    timeSignature: [4, 4],
    sampleRate: 44100,
    duration: 30,
    sources: {},
    tracks: [initialTrack],
    clips: [initialClip],
    markers: [],
    sections: [],
    masterVolume: 1.0,
    masterLimiterCeiling: -0.1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('splits a clip non-destructively and handles undo/redo', () => {
    const cmdManager = new CommandManager();
    const splitCmd = new SplitClipCommand('clip-1', 8); // 3 seconds into clip

    // Split
    const projAfterSplit = cmdManager.execute(splitCmd, initialProject);
    expect(projAfterSplit.clips.length).toBe(2);
    expect(projAfterSplit.clips[0].sourceIn).toBe(0);
    expect(projAfterSplit.clips[0].sourceOut).toBe(3);
    expect(projAfterSplit.clips[0].startTime).toBe(5);

    expect(projAfterSplit.clips[1].sourceIn).toBe(3);
    expect(projAfterSplit.clips[1].sourceOut).toBe(10);
    expect(projAfterSplit.clips[1].startTime).toBe(8);

    // Undo
    const projAfterUndo = cmdManager.undo(projAfterSplit);
    expect(projAfterUndo.clips.length).toBe(1);
    expect(projAfterUndo.clips[0].id).toBe('clip-1');
    expect(projAfterUndo.clips[0].sourceOut).toBe(10);

    // Redo
    const projAfterRedo = cmdManager.redo(projAfterUndo);
    expect(projAfterRedo.clips.length).toBe(2);
  });

  it('moves a clip and supports undo/redo', () => {
    const cmdManager = new CommandManager();
    const moveCmd = new MoveClipCommand('clip-1', 12);

    const projMoved = cmdManager.execute(moveCmd, initialProject);
    expect(projMoved.clips[0].startTime).toBe(12);

    const projUndone = cmdManager.undo(projMoved);
    expect(projUndone.clips[0].startTime).toBe(5);
  });

  it('trims a clip non-destructively', () => {
    const cmdManager = new CommandManager();
    const trimCmd = new TrimClipCommand('clip-1', 2, 8, 7);

    const projTrimmed = cmdManager.execute(trimCmd, initialProject);
    expect(projTrimmed.clips[0].sourceIn).toBe(2);
    expect(projTrimmed.clips[0].sourceOut).toBe(8);
    expect(projTrimmed.clips[0].startTime).toBe(7);

    const projUndone = cmdManager.undo(projTrimmed);
    expect(projUndone.clips[0].sourceIn).toBe(0);
    expect(projUndone.clips[0].sourceOut).toBe(10);
    expect(projUndone.clips[0].startTime).toBe(5);
  });

  it('configures clip fade envelopes reversibly', () => {
    const cmdManager = new CommandManager();
    const fadeCmd = new SetClipFadeCommand('clip-1', { duration: 0.5, curve: 'linear' }, { duration: 1.0, curve: 'linear' });

    const projFaded = cmdManager.execute(fadeCmd, initialProject);
    expect(projFaded.clips[0].fadeIn?.duration).toBe(0.5);
    expect(projFaded.clips[0].fadeOut?.duration).toBe(1.0);

    const projUndone = cmdManager.undo(projFaded);
    expect(projUndone.clips[0].fadeIn).toBeUndefined();
  });
});
