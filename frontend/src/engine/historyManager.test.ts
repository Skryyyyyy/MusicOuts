import { describe, it, expect } from 'vitest';
import { HistoryManager, HistoryStatePayload } from './historyManager';
import { DEFAULT_FX_RACK_STATE } from '../types';

describe('HistoryManager (DAW Undo/Redo Engine)', () => {
  const createBaseState = (): HistoryStatePayload => ({
    stems: {
      vocals: { volume: 0.8, muted: false, solo: false, pan: 0 },
      drums: { volume: 0.9, muted: false, solo: false, pan: 0 },
      bass: { volume: 0.85, muted: false, solo: false, pan: 0 },
      other: { volume: 0.75, muted: false, solo: false, pan: 0 },
    },
    fxRack: DEFAULT_FX_RACK_STATE,
    clips: [],
    automationPoints: [],
    masterVolume: 1.0,
    djFilterCutoff: 20000,
    djFilterType: 'lowpass',
  });

  it('initializes with base state without undo/redo available', () => {
    const base = createBaseState();
    const history = new HistoryManager(base);

    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
    expect(history.getCurrentState()?.stems.vocals.volume).toBe(0.8);
  });

  it('pushes new state and enables undo', () => {
    const base = createBaseState();
    const history = new HistoryManager(base);

    const state2 = createBaseState();
    state2.stems.vocals.volume = 0.5;
    history.pushState('Adjust Vocals Volume', state2);

    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
    expect(history.getUndoDescription()).toBe('Initial State');
    expect(history.getCurrentState()?.stems.vocals.volume).toBe(0.5);
  });

  it('undoes state and enables redo', () => {
    const base = createBaseState();
    const history = new HistoryManager(base);

    const state2 = createBaseState();
    state2.stems.vocals.volume = 0.3;
    history.pushState('Drop Vocals Volume', state2);

    const undone = history.undo();
    expect(undone).not.toBeNull();
    expect(undone?.state.stems.vocals.volume).toBe(0.8);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(true);
    expect(history.getRedoDescription()).toBe('Drop Vocals Volume');
  });

  it('redoes previously undone state', () => {
    const base = createBaseState();
    const history = new HistoryManager(base);

    const state2 = createBaseState();
    state2.masterVolume = 0.6;
    history.pushState('Lower Master Volume', state2);

    history.undo();
    expect(history.getCurrentState()?.masterVolume).toBe(1.0);

    const redone = history.redo();
    expect(redone).not.toBeNull();
    expect(redone?.state.masterVolume).toBe(0.6);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);
  });

  it('clears redo stack when new action is pushed after undo', () => {
    const base = createBaseState();
    const history = new HistoryManager(base);

    const state2 = createBaseState();
    state2.masterVolume = 0.5;
    history.pushState('Action 1', state2);

    history.undo();
    expect(history.canRedo()).toBe(true);

    const state3 = createBaseState();
    state3.masterVolume = 0.2;
    history.pushState('Action 2', state3);

    expect(history.canRedo()).toBe(false);
    expect(history.canUndo()).toBe(true);
    expect(history.getCurrentState()?.masterVolume).toBe(0.2);
  });

  it('properly deep-clones state to prevent reference corruption', () => {
    const base = createBaseState();
    const history = new HistoryManager(base);

    const state2 = createBaseState();
    state2.clips.push({
      id: 'clip_1',
      name: 'Original Clip',
      songId: 'song_1',
      songTitle: 'Test',
      stem: 'vocals',
      startTime: 0,
      sourceOffset: 0,
      duration: 10,
      gain: 1.0,
      muted: false,
    });
    history.pushState('Add Clip', state2);

    // Mutate state2 externally
    state2.clips[0].name = 'Mutated Clip';

    // The recorded history should still have 'Original Clip'
    expect(history.getCurrentState()?.clips[0].name).toBe('Original Clip');
  });

  it('caps history stack to maxHistory', () => {
    const base = createBaseState();
    const history = new HistoryManager(base, 3); // Max 3 items

    for (let i = 1; i <= 5; i++) {
      const s = createBaseState();
      s.masterVolume = i * 0.1;
      history.pushState(`Action ${i}`, s);
    }

    const { undoCount } = history.getStackCounts();
    expect(undoCount).toBe(3);
  });
});
