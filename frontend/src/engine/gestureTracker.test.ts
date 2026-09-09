import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateEuclideanDistance,
  isPinchGesture,
  isFistGesture,
  mapXToDjFilter,
  applyEmaSmoothing,
  smoothLandmark,
  smoothLandmarks,
  GestureTracker,
  Point3D,
  DEFAULT_PINCH_THRESHOLD,
  DEFAULT_FIST_THRESHOLD,
  MIN_LP_FREQ,
  MAX_LP_FREQ,
  MAX_HP_FREQ,
} from './gestureTracker';

// Helper to generate a dummy 21-landmark array
function createDummyLandmarks(wrist: Point3D = { x: 0.5, y: 0.8, z: 0 }): Point3D[] {
  const points: Point3D[] = [];
  for (let i = 0; i < 21; i++) {
    points.push({
      x: wrist.x + i * 0.01,
      y: wrist.y - i * 0.02,
      z: 0,
    });
  }
  return points;
}

describe('Gesture Engine Pure Helper Functions', () => {
  describe('calculateEuclideanDistance', () => {
    it('calculates exact 2D distance when z is omitted', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 3, y: 4 };
      expect(calculateEuclideanDistance(p1, p2)).toBeCloseTo(5.0);
    });

    it('calculates 3D Euclidean distance when z is present', () => {
      const p1 = { x: 1, y: 2, z: 3 };
      const p2 = { x: 4, y: 6, z: 3 };
      expect(calculateEuclideanDistance(p1, p2)).toBeCloseTo(5.0);

      const p3 = { x: 0, y: 0, z: 0 };
      const p4 = { x: 2, y: 3, z: 6 };
      expect(calculateEuclideanDistance(p3, p4)).toBeCloseTo(7.0);
    });

    it('returns 0 for identical points', () => {
      const p = { x: 0.42, y: 0.88, z: -0.1 };
      expect(calculateEuclideanDistance(p, p)).toBe(0);
    });
  });

  describe('isPinchGesture', () => {
    it('returns true when thumb tip (point 4) and index tip (point 8) distance < threshold', () => {
      const landmarks = createDummyLandmarks();
      // Set points 4 and 8 very close
      landmarks[4] = { x: 0.5, y: 0.5, z: 0 };
      landmarks[8] = { x: 0.52, y: 0.51, z: 0 }; // distance = sqrt(0.0004 + 0.0001) ~= 0.0223 < 0.06

      expect(isPinchGesture(landmarks, DEFAULT_PINCH_THRESHOLD)).toBe(true);
    });

    it('returns false when thumb tip and index tip are separated', () => {
      const landmarks = createDummyLandmarks();
      landmarks[4] = { x: 0.2, y: 0.5, z: 0 };
      landmarks[8] = { x: 0.6, y: 0.5, z: 0 }; // distance = 0.4 > 0.06

      expect(isPinchGesture(landmarks, DEFAULT_PINCH_THRESHOLD)).toBe(false);
    });

    it('returns false when landmark list is incomplete or empty', () => {
      expect(isPinchGesture([])).toBe(false);
      expect(isPinchGesture([{ x: 0, y: 0 }])).toBe(false);
    });

    it('respects custom threshold', () => {
      const landmarks = createDummyLandmarks();
      landmarks[4] = { x: 0.5, y: 0.5, z: 0 };
      landmarks[8] = { x: 0.55, y: 0.5, z: 0 }; // distance = 0.05

      expect(isPinchGesture(landmarks, 0.04)).toBe(false);
      expect(isPinchGesture(landmarks, 0.06)).toBe(true);
    });
  });

  describe('isFistGesture', () => {
    it('returns true when fingertips (8, 12, 16, 20) are close to wrist (0)', () => {
      const landmarks = createDummyLandmarks();
      landmarks[0] = { x: 0.5, y: 0.5, z: 0 }; // wrist
      landmarks[8] = { x: 0.52, y: 0.52, z: 0 }; // index tip (~0.028)
      landmarks[12] = { x: 0.51, y: 0.53, z: 0 }; // middle tip (~0.031)
      landmarks[16] = { x: 0.49, y: 0.52, z: 0 }; // ring tip (~0.022)
      landmarks[20] = { x: 0.48, y: 0.51, z: 0 }; // pinky tip (~0.022)

      expect(isFistGesture(landmarks, DEFAULT_FIST_THRESHOLD)).toBe(true);
    });

    it('returns false for open hand with extended fingers', () => {
      const landmarks = createDummyLandmarks();
      landmarks[0] = { x: 0.5, y: 0.9, z: 0 }; // wrist at bottom
      landmarks[8] = { x: 0.5, y: 0.2, z: 0 }; // dist 0.7
      landmarks[12] = { x: 0.5, y: 0.1, z: 0 }; // dist 0.8
      landmarks[16] = { x: 0.5, y: 0.15, z: 0 }; // dist 0.75
      landmarks[20] = { x: 0.5, y: 0.25, z: 0 }; // dist 0.65

      expect(isFistGesture(landmarks, DEFAULT_FIST_THRESHOLD)).toBe(false);
    });

    it('returns false when landmarks array has fewer than 21 points', () => {
      expect(isFistGesture([])).toBe(false);
      expect(isFistGesture(new Array(15).fill({ x: 0, y: 0, z: 0 }))).toBe(false);
    });
  });

  describe('mapXToDjFilter', () => {
    it('maps x < 0.45 to lowpass sweep from 200Hz to 20000Hz', () => {
      const minLp = mapXToDjFilter(0.0);
      expect(minLp.type).toBe('lowpass');
      expect(minLp.cutoff).toBe(MIN_LP_FREQ);

      const midLp = mapXToDjFilter(0.225);
      expect(midLp.type).toBe('lowpass');
      expect(midLp.cutoff).toBeCloseTo(10100, -1);

      const upperLp = mapXToDjFilter(0.449);
      expect(upperLp.type).toBe('lowpass');
      expect(upperLp.cutoff).toBeGreaterThan(19000);
    });

    it('maps 0.45 <= x <= 0.55 to center neutral lowpass bypass (20000Hz)', () => {
      const leftBoundary = mapXToDjFilter(0.45);
      expect(leftBoundary.type).toBe('lowpass');
      expect(leftBoundary.cutoff).toBe(MAX_LP_FREQ);

      const center = mapXToDjFilter(0.50);
      expect(center.type).toBe('lowpass');
      expect(center.cutoff).toBe(MAX_LP_FREQ);

      const rightBoundary = mapXToDjFilter(0.55);
      expect(rightBoundary.type).toBe('lowpass');
      expect(rightBoundary.cutoff).toBe(MAX_LP_FREQ);
    });

    it('maps x > 0.55 to highpass sweep from 20Hz to 5000Hz', () => {
      const lowerHp = mapXToDjFilter(0.551);
      expect(lowerHp.type).toBe('highpass');
      expect(lowerHp.cutoff).toBeLessThan(100);

      const midHp = mapXToDjFilter(0.775);
      expect(midHp.type).toBe('highpass');
      expect(midHp.cutoff).toBeCloseTo(2510, -1);

      const maxHp = mapXToDjFilter(1.0);
      expect(maxHp.type).toBe('highpass');
      expect(maxHp.cutoff).toBe(MAX_HP_FREQ);
    });

    it('clamps inputs below 0.0 and above 1.0', () => {
      const negativeX = mapXToDjFilter(-0.5);
      expect(negativeX.type).toBe('lowpass');
      expect(negativeX.cutoff).toBe(MIN_LP_FREQ);

      const overX = mapXToDjFilter(1.5);
      expect(overX.type).toBe('highpass');
      expect(overX.cutoff).toBe(MAX_HP_FREQ);
    });
  });

  describe('applyEmaSmoothing', () => {
    it('applies standard EMA formula: alpha * current + (1 - alpha) * prev', () => {
      const prev = 10;
      const current = 20;
      const alpha = 0.35;
      const expected = 0.35 * 20 + 0.65 * 10; // 7 + 6.5 = 13.5
      expect(applyEmaSmoothing(prev, current, alpha)).toBeCloseTo(expected);
    });

    it('converges smoothly to step change over iterations', () => {
      let smoothed = 0;
      const target = 1.0;
      const alpha = 0.35;

      for (let i = 0; i < 20; i++) {
        smoothed = applyEmaSmoothing(smoothed, target, alpha);
      }
      expect(smoothed).toBeGreaterThan(0.999);
    });

    it('smooths 3D landmarks correctly', () => {
      const p1: Point3D = { x: 0, y: 10, z: 20 };
      const p2: Point3D = { x: 10, y: 20, z: 30 };
      const smoothed = smoothLandmark(p1, p2, 0.5);

      expect(smoothed.x).toBeCloseTo(5);
      expect(smoothed.y).toBeCloseTo(15);
      expect(smoothed.z).toBeCloseTo(25);
    });

    it('smooths arrays of landmarks', () => {
      const list1 = createDummyLandmarks({ x: 0, y: 0, z: 0 });
      const list2 = createDummyLandmarks({ x: 1, y: 1, z: 1 });
      const smoothedList = smoothLandmarks(list1, list2, 0.5);

      expect(smoothedList.length).toBe(21);
      expect(smoothedList[0].x).toBeCloseTo(0.5);
      expect(smoothedList[0].y).toBeCloseTo(0.5);
    });
  });
});

describe('GestureTracker Class', () => {
  let tracker: GestureTracker;

  beforeEach(() => {
    tracker = new GestureTracker();
  });

  it('instantiates with default options and starts uninitialized', () => {
    expect(tracker.isReady()).toBe(false);
    expect(tracker.isTracking()).toBe(false);
    expect(tracker.getLandmarker()).toBeNull();
  });

  it('processes video frames with mock landmarker and computes gesture state', () => {
    // Create mock HandLandmarker
    const leftLandmarks = createDummyLandmarks({ x: 0.3, y: 0.4, z: 0 }); // y=0.4 => height = 1 - 0.4 = 0.6
    const rightLandmarks = createDummyLandmarks({ x: 0.8, y: 0.7, z: 0 }); // x=0.8 (highpass), y=0.7 => height = 0.3

    const mockDetectForVideo = vi.fn().mockReturnValue({
      landmarks: [leftLandmarks, rightLandmarks],
      handedness: [[{ categoryName: 'Left' }], [{ categoryName: 'Right' }]],
    });

    // Inject mock landmarker into tracker instance
    (tracker as any).landmarker = {
      detectForVideo: mockDetectForVideo,
      close: vi.fn(),
    };

    const mockVideo = {} as HTMLVideoElement;
    const result = tracker.processFrame(mockVideo, 1000);

    expect(result).not.toBeNull();
    if (!result) return;

    // Left hand checks
    expect(result.state.leftHand.present).toBe(true);
    expect(result.state.leftHand.height).toBeCloseTo(0.6);
    expect(result.state.leftHand.x).toBeCloseTo(0.3);

    // Right hand checks
    expect(result.state.rightHand.present).toBe(true);
    expect(result.state.rightHand.height).toBeCloseTo(0.3);
    expect(result.state.rightHand.x).toBeCloseTo(0.8);

    // Filter checks (x=0.8 > 0.55 -> highpass)
    expect(result.state.djFilterType).toBe('highpass');
    expect(result.state.djFilterCutoff).toBeGreaterThan(2000);
  });

  it('correctly triggers dual fist master kill switch', () => {
    const leftFist = createDummyLandmarks({ x: 0.3, y: 0.5, z: 0 });
    // Make left fist closed
    leftFist[0] = { x: 0.3, y: 0.5, z: 0 };
    leftFist[8] = { x: 0.31, y: 0.51, z: 0 };
    leftFist[12] = { x: 0.31, y: 0.51, z: 0 };
    leftFist[16] = { x: 0.31, y: 0.51, z: 0 };
    leftFist[20] = { x: 0.31, y: 0.51, z: 0 };

    const rightFist = createDummyLandmarks({ x: 0.7, y: 0.5, z: 0 });
    // Make right fist closed
    rightFist[0] = { x: 0.7, y: 0.5, z: 0 };
    rightFist[8] = { x: 0.71, y: 0.51, z: 0 };
    rightFist[12] = { x: 0.71, y: 0.51, z: 0 };
    rightFist[16] = { x: 0.71, y: 0.51, z: 0 };
    rightFist[20] = { x: 0.71, y: 0.51, z: 0 };

    (tracker as any).landmarker = {
      detectForVideo: vi.fn().mockReturnValue({
        landmarks: [leftFist, rightFist],
        handedness: [[{ categoryName: 'Left' }], [{ categoryName: 'Right' }]],
      }),
      close: vi.fn(),
    };

    const mockVideo = {} as HTMLVideoElement;
    // Frame 1: Starts hold countdown
    const frame1 = tracker.processFrame(mockVideo, 1000);
    expect(frame1?.state.leftHand.isFist).toBe(true);
    expect(frame1?.state.rightHand.isFist).toBe(true);
    expect(frame1?.state.isDualFist).toBe(false);

    // Frame 2: After 400ms hold (> 350ms), dual fist kill switch engages!
    const frame2 = tracker.processFrame(mockVideo, 1400);
    expect(frame2?.state.isDualFist).toBe(true);
    expect(frame2?.state.fistHoldProgress).toBe(1.0);
  });

  it('correctly triggers left hand pinch for solo vocals', () => {
    const leftPinch = createDummyLandmarks({ x: 0.3, y: 0.5, z: 0 });
    leftPinch[4] = { x: 0.3, y: 0.5, z: 0 };
    leftPinch[8] = { x: 0.31, y: 0.51, z: 0 }; // pinch

    (tracker as any).landmarker = {
      detectForVideo: vi.fn().mockReturnValue({
        landmarks: [leftPinch],
        handedness: [[{ categoryName: 'Left' }]],
      }),
      close: vi.fn(),
    };

    const mockVideo = {} as HTMLVideoElement;
    const result = tracker.processFrame(mockVideo, 1000);

    expect(result?.state.leftHand.present).toBe(true);
    expect(result?.state.leftHand.isPinching).toBe(true);
    expect(result?.state.rightHand.present).toBe(false);
  });

  it('properly handles stopTracking and dispose lifecycle', () => {
    const mockClose = vi.fn();
    (tracker as any).landmarker = {
      close: mockClose,
    };

    tracker.dispose();
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(tracker.isReady()).toBe(false);
    expect(tracker.isTracking()).toBe(false);
  });
});
