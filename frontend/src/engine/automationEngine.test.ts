import { describe, it, expect, beforeEach } from 'vitest';
import { AutomationManager, PerformanceCaptureTracker } from './automationEngine';
import { MusicOutsProject, DEFAULT_FX_RACK_STATE } from '../types';

describe('AutomationManager', () => {
  let manager: AutomationManager;

  beforeEach(() => {
    manager = new AutomationManager();
  });

  it('initializes with empty points', () => {
    expect(manager.getPoints()).toEqual([]);
    expect(manager.isRecording()).toBe(false);
  });

  it('records points when recording is armed', () => {
    manager.setRecording(true);
    expect(manager.isRecording()).toBe(true);

    manager.recordPoint(1.0, 'vocals.volume', 0.8);
    const points = manager.getPoints('vocals.volume');
    expect(points.length).toBe(1);
    expect(points[0].time).toBe(1.0);
    expect(points[0].value).toBe(0.8);
    expect(points[0].target).toBe('vocals.volume');
  });

  it('does not record points when recording is disabled', () => {
    manager.setRecording(false);
    manager.recordPoint(1.0, 'vocals.volume', 0.8);
    expect(manager.getPoints()).toEqual([]);
  });

  it('smoothly interpolates values at time t between two points', () => {
    manager.addPoint({ id: 'p1', time: 1.0, target: 'vocals.volume', value: 0.2 });
    manager.addPoint({ id: 'p2', time: 3.0, target: 'vocals.volume', value: 0.8 });

    // Exact mid-point at t = 2.0s should be exactly 0.5
    const atTwo = manager.evaluateAt(2.0);
    expect(atTwo['vocals.volume']).toBeCloseTo(0.5, 4);

    // Before first point at t = 0.5s should clamp to 0.2
    const atZero = manager.evaluateAt(0.5);
    expect(atZero['vocals.volume']).toBe(0.2);

    // After last point at t = 5.0s should clamp to 0.8
    const atFive = manager.evaluateAt(5.0);
    expect(atFive['vocals.volume']).toBe(0.8);
  });

  it('clears points for a specific target lane', () => {
    manager.addPoint({ id: 'p1', time: 1.0, target: 'vocals.volume', value: 0.5 });
    manager.addPoint({ id: 'p2', time: 1.5, target: 'drums.volume', value: 0.9 });

    manager.clearTarget('vocals.volume');
    expect(manager.getPoints('vocals.volume')).toEqual([]);
    expect(manager.getPoints('drums.volume').length).toBe(1);
  });
});

describe('PerformanceCaptureTracker', () => {
  let tracker: PerformanceCaptureTracker;
  const mockProject: MusicOutsProject = {
    version: '1.1',
    title: 'Test Performance',
    trackId: 'track_123',
    duration: 180,
    bpm: 128,
    key: 'F# Minor',
    timeSignature: '4/4',
    mode: 'performance',
    stemStates: {
      vocals: { volume: 1.0, muted: false, solo: false, pan: 0 },
      drums: { volume: 1.0, muted: false, solo: false, pan: 0 },
      bass: { volume: 1.0, muted: false, solo: false, pan: 0 },
      other: { volume: 1.0, muted: false, solo: false, pan: 0 },
    },
    fxRack: DEFAULT_FX_RACK_STATE,
    masterVolume: 1.0,
    djFilterCutoff: 20000,
    djFilterType: 'lowpass',
    isDucking: false,
    markers: [],
    automation: [],
    created: new Date().toISOString(),
  };

  beforeEach(() => {
    tracker = new PerformanceCaptureTracker();
  });

  it('tracks capture lifecycle and logs modulations', () => {
    expect(tracker.isCapturing()).toBe(false);

    tracker.startCapture(mockProject);
    expect(tracker.isCapturing()).toBe(true);

    tracker.logEvent(1.2, 'gesture', { hand: 'left', height: 0.75 });
    tracker.logEvent(2.5, 'scene', { sceneName: 'DROP' });
    tracker.logEvent(3.0, 'filter', { cutoff: 4500, type: 'lowpass' });

    const session = tracker.stopCapture(mockProject);
    expect(session).not.toBeNull();
    expect(session?.totalGestures).toBe(1);
    expect(session?.scenesTriggered).toContain('DROP');
    expect(session?.events.length).toBe(3);
    expect(tracker.isCapturing()).toBe(false);
  });
});
