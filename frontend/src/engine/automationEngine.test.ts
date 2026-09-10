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

  it('toggles keyframe on/off at playhead position (Adobe Premiere style)', () => {
    // 1. Toggle adds keyframe when none exists
    const res1 = manager.toggleKeyframeAt(2.0, 'vocals.volume', 0.75, 'bezier');
    expect(res1.action).toBe('added');
    expect(res1.point?.value).toBe(0.75);
    expect(res1.point?.curve).toBe('bezier');
    expect(manager.getPoints('vocals.volume').length).toBe(1);

    // 2. Toggle removes keyframe when playhead is on existing keyframe
    const res2 = manager.toggleKeyframeAt(2.05, 'vocals.volume', 0.75, 'bezier', 0.1);
    expect(res2.action).toBe('removed');
    expect(manager.getPoints('vocals.volume').length).toBe(0);
  });

  it('navigates previous and next keyframes for Adobe [◀ ◆ ▶] navigator', () => {
    manager.addPoint({ id: 'k1', time: 1.0, target: 'vocals.volume', value: 0.2 });
    manager.addPoint({ id: 'k2', time: 4.0, target: 'vocals.volume', value: 0.8 });
    manager.addPoint({ id: 'k3', time: 7.0, target: 'vocals.volume', value: 0.5 });

    // At t = 2.5: prev is k1, current is null, next is k2
    const nav1 = manager.getNavigatorKeyframes(2.5, 'vocals.volume');
    expect(nav1.prev?.id).toBe('k1');
    expect(nav1.current).toBeNull();
    expect(nav1.next?.id).toBe('k2');

    // At t = 4.05: current is k2, prev is k1, next is k3
    const nav2 = manager.getNavigatorKeyframes(4.05, 'vocals.volume', 0.1);
    expect(nav2.current?.id).toBe('k2');
    expect(nav2.prev?.id).toBe('k1');
    expect(nav2.next?.id).toBe('k3');
  });

  it('evaluates Bezier, Linear, and Hold easing curves correctly', () => {
    // Test Hold: value stays constant at p1 until p2
    manager.addPoint({ id: 'h1', time: 0.0, target: 'vocals.volume', value: 0.2, curve: 'hold' });
    manager.addPoint({ id: 'h2', time: 2.0, target: 'vocals.volume', value: 0.8, curve: 'hold' });

    expect(manager.evaluateAt(1.0)['vocals.volume']).toBe(0.2);
    expect(manager.evaluateAt(1.99)['vocals.volume']).toBe(0.2);
    expect(manager.evaluateAt(2.0)['vocals.volume']).toBe(0.8);

    // Test Bezier: smooth S-curve easing
    manager.clearAll();
    manager.addPoint({ id: 'b1', time: 0.0, target: 'drums.volume', value: 0.0, curve: 'bezier' });
    manager.addPoint({ id: 'b2', time: 1.0, target: 'drums.volume', value: 1.0, curve: 'bezier' });

    // In cubic smoothstep: at t=0.25, smooth = 3*(0.25)^2 - 2*(0.25)^3 = 0.1875 - 0.03125 = 0.15625 < 0.25
    expect(manager.evaluateAt(0.25)['drums.volume']).toBeCloseTo(0.15625, 4);
    // at t=0.5, smooth = 0.5
    expect(manager.evaluateAt(0.5)['drums.volume']).toBeCloseTo(0.5, 4);
    // at t=0.75, smooth = 0.84375 > 0.75
    expect(manager.evaluateAt(0.75)['drums.volume']).toBeCloseTo(0.84375, 4);
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
