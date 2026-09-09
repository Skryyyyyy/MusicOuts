import { FilesetResolver, HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { GestureState, HandData } from '../types';

export const DEFAULT_WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
export const DEFAULT_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export const DEFAULT_EMA_ALPHA = 0.35;
export const DEFAULT_PINCH_THRESHOLD = 0.06;
export const DEFAULT_FIST_THRESHOLD = 0.15;

export const MIN_LP_FREQ = 200;
export const MAX_LP_FREQ = 20000;
export const MIN_HP_FREQ = 20;
export const MAX_HP_FREQ = 5000;

export interface Point3D {
  x: number;
  y: number;
  z?: number;
}

export interface DjFilterMapping {
  cutoff: number;
  type: 'lowpass' | 'highpass';
}

export interface GestureTrackerOptions {
  alpha?: number;
  pinchThreshold?: number;
  fistThreshold?: number;
}

export const DEFAULT_HAND_DATA: HandData = {
  present: false,
  height: 0.0,
  isPinching: false,
  isFist: false,
  x: 0.5,
  y: 0.5,
};

export const DEFAULT_GESTURE_STATE: GestureState = {
  leftHand: { ...DEFAULT_HAND_DATA },
  rightHand: { ...DEFAULT_HAND_DATA },
  isDualFist: false,
  djFilterCutoff: 20000,
  djFilterType: 'lowpass',
};

/**
 * Calculates 3D Euclidean distance between two landmark points.
 */
export function calculateEuclideanDistance(p1: Point3D, p2: Point3D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z ?? 0) - (p2.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Determines whether hand landmark configuration is a pinch gesture
 * (Thumb Tip Point 4 to Index Tip Point 8 distance < threshold).
 */
export function isPinchGesture(
  landmarks: Point3D[],
  threshold: number = DEFAULT_PINCH_THRESHOLD
): boolean {
  if (!landmarks || landmarks.length <= 8) return false;
  const distance = calculateEuclideanDistance(landmarks[4], landmarks[8]);
  return distance < threshold;
}

/**
 * Determines whether hand landmark configuration is a closed fist
 * (Average distance of finger tips 8, 12, 16, 20 to wrist/palm base 0 < threshold).
 */
export function isFistGesture(
  landmarks: Point3D[],
  threshold: number = DEFAULT_FIST_THRESHOLD
): boolean {
  if (!landmarks || landmarks.length < 21) return false;
  const wrist = landmarks[0];
  const tipIndices = [8, 12, 16, 20];

  let totalDist = 0;
  for (const idx of tipIndices) {
    totalDist += calculateEuclideanDistance(wrist, landmarks[idx]);
  }
  const avgDist = totalDist / tipIndices.length;
  return avgDist < threshold;
}

/**
 * Maps Right Hand X coordinate to DJ Biquad filter parameters:
 * - x < 0.45: Low-pass filter modulation (200Hz to 20kHz)
 * - 0.45 <= x <= 0.55: Center neutral bypass zone (20kHz lowpass)
 * - x > 0.55: High-pass filter sweep (20Hz to 5kHz)
 */
export function mapXToDjFilter(x: number): DjFilterMapping {
  const clampedX = Math.max(0.0, Math.min(1.0, x));

  if (clampedX < 0.45) {
    // Low-pass sweep from 200Hz (at x=0.0) to 20000Hz (at x=0.45)
    const t = clampedX / 0.45;
    const cutoff = MIN_LP_FREQ + t * (MAX_LP_FREQ - MIN_LP_FREQ);
    return {
      cutoff: Math.round(cutoff),
      type: 'lowpass',
    };
  }

  if (clampedX > 0.55) {
    // High-pass sweep from 20Hz (at x=0.55) to 5000Hz (at x=1.0)
    const t = (clampedX - 0.55) / 0.45;
    const cutoff = MIN_HP_FREQ + t * (MAX_HP_FREQ - MIN_HP_FREQ);
    return {
      cutoff: Math.round(cutoff),
      type: 'highpass',
    };
  }

  // Center neutral zone (0.45 <= x <= 0.55): Full-range bypass lowpass
  return {
    cutoff: MAX_LP_FREQ,
    type: 'lowpass',
  };
}

/**
 * Applies Exponential Moving Average (EMA) smoothing to a scalar value.
 * formula: y_t = alpha * x_t + (1 - alpha) * y_{t-1}
 */
export function applyEmaSmoothing(
  prev: number,
  current: number,
  alpha: number = DEFAULT_EMA_ALPHA
): number {
  return alpha * current + (1 - alpha) * prev;
}

/**
 * Applies EMA smoothing to 3D point landmark.
 */
export function smoothLandmark(
  prev: Point3D,
  current: Point3D,
  alpha: number = DEFAULT_EMA_ALPHA
): Point3D {
  return {
    x: applyEmaSmoothing(prev.x, current.x, alpha),
    y: applyEmaSmoothing(prev.y, current.y, alpha),
    z: applyEmaSmoothing(prev.z ?? 0, current.z ?? 0, alpha),
  };
}

/**
 * Applies EMA smoothing across full 21-landmark array.
 */
export function smoothLandmarks(
  prevList: Point3D[] | undefined,
  currentList: Point3D[],
  alpha: number = DEFAULT_EMA_ALPHA
): Point3D[] {
  if (!prevList || prevList.length !== currentList.length) {
    return currentList.map((pt) => ({ ...pt }));
  }
  return currentList.map((pt, i) => smoothLandmark(prevList[i], pt, alpha));
}

/**
 * MediaPipe Real-Time Hand Landmark Tracking & Gesture Recognition Engine.
 */
export class GestureTracker {
  private landmarker: HandLandmarker | null = null;
  private animFrameId: number | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private onFrameCallback:
    | ((state: GestureState, rawLandmarks?: NormalizedLandmark[][]) => void)
    | null = null;

  private previousLandmarks: Map<string, Point3D[]> = new Map();
  private alpha: number;
  private pinchThreshold: number;
  private fistThreshold: number;
  private isTrackingState: boolean = false;

  constructor(options?: GestureTrackerOptions) {
    this.alpha = options?.alpha ?? DEFAULT_EMA_ALPHA;
    this.pinchThreshold = options?.pinchThreshold ?? DEFAULT_PINCH_THRESHOLD;
    this.fistThreshold = options?.fistThreshold ?? DEFAULT_FIST_THRESHOLD;
  }

  /**
   * Initializes the MediaPipe Vision WASM Fileset and HandLandmarker task runner.
   */
  public async initialize(
    wasmPath: string = DEFAULT_WASM_PATH,
    modelPath: string = DEFAULT_MODEL_PATH
  ): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(wasmPath);

    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
    } catch {
      // Fallback to CPU delegate if GPU delegate initialization is unavailable
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
    }
  }

  /**
   * Starts continuous real-time tracking on the provided HTMLVideoElement via requestAnimationFrame.
   */
  public startTracking(
    videoElement: HTMLVideoElement,
    onFrame: (state: GestureState, rawLandmarks?: NormalizedLandmark[][]) => void
  ): void {
    this.videoElement = videoElement;
    this.onFrameCallback = onFrame;
    this.isTrackingState = true;
    this.previousLandmarks.clear();

    const loop = () => {
      if (!this.isTrackingState) return;

      if (
        this.videoElement &&
        this.landmarker &&
        this.videoElement.readyState >= 2 &&
        !this.videoElement.paused
      ) {
        const result = this.processFrame(this.videoElement, performance.now());
        if (result && this.onFrameCallback) {
          this.onFrameCallback(result.state, result.rawLandmarks);
        }
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  /**
   * Processes a single video frame and calculates smoothed gesture states.
   */
  public processFrame(
    videoElement: HTMLVideoElement,
    timestamp: number = performance.now()
  ): { state: GestureState; rawLandmarks: NormalizedLandmark[][] } | null {
    if (!this.landmarker) return null;

    let result;
    try {
      result = this.landmarker.detectForVideo(videoElement, timestamp);
    } catch {
      return null;
    }

    const rawLandmarks = result?.landmarks || [];
    const handednesses = result?.handedness || [];

    let leftLandmarksRaw: NormalizedLandmark[] | null = null;
    let rightLandmarksRaw: NormalizedLandmark[] | null = null;

    for (let i = 0; i < rawLandmarks.length; i++) {
      const landmarks = rawLandmarks[i];
      const handedness = handednesses[i]?.[0]?.categoryName;

      if (handedness === 'Left') {
        leftLandmarksRaw = landmarks;
      } else if (handedness === 'Right') {
        rightLandmarksRaw = landmarks;
      } else if (i === 0) {
        leftLandmarksRaw = landmarks;
      } else if (i === 1) {
        rightLandmarksRaw = landmarks;
      }
    }

    // Process Left Hand
    let leftHand: HandData = { ...DEFAULT_HAND_DATA };
    if (leftLandmarksRaw && leftLandmarksRaw.length >= 21) {
      const smoothed = smoothLandmarks(
        this.previousLandmarks.get('Left'),
        leftLandmarksRaw,
        this.alpha
      );
      this.previousLandmarks.set('Left', smoothed);

      const wrist = smoothed[0];
      const height = Math.max(0.0, Math.min(1.0, 1.0 - wrist.y));
      const x = Math.max(0.0, Math.min(1.0, wrist.x));
      const y = Math.max(0.0, Math.min(1.0, wrist.y));
      const isPinching = isPinchGesture(smoothed, this.pinchThreshold);
      const isFist = isFistGesture(smoothed, this.fistThreshold);

      leftHand = {
        present: true,
        height,
        isPinching,
        isFist,
        x,
        y,
      };
    } else {
      this.previousLandmarks.delete('Left');
    }

    // Process Right Hand
    let rightHand: HandData = { ...DEFAULT_HAND_DATA };
    if (rightLandmarksRaw && rightLandmarksRaw.length >= 21) {
      const smoothed = smoothLandmarks(
        this.previousLandmarks.get('Right'),
        rightLandmarksRaw,
        this.alpha
      );
      this.previousLandmarks.set('Right', smoothed);

      const wrist = smoothed[0];
      const height = Math.max(0.0, Math.min(1.0, 1.0 - wrist.y));
      const x = Math.max(0.0, Math.min(1.0, wrist.x));
      const y = Math.max(0.0, Math.min(1.0, wrist.y));
      const isPinching = isPinchGesture(smoothed, this.pinchThreshold);
      const isFist = isFistGesture(smoothed, this.fistThreshold);

      rightHand = {
        present: true,
        height,
        isPinching,
        isFist,
        x,
        y,
      };
    } else {
      this.previousLandmarks.delete('Right');
    }

    // Dual fist kill switch
    const isDualFist = leftHand.present && rightHand.present && leftHand.isFist && rightHand.isFist;

    // DJ Biquad filter calculation
    let djFilterCutoff = 20000;
    let djFilterType: 'lowpass' | 'highpass' = 'lowpass';

    if (rightHand.present) {
      const filter = mapXToDjFilter(rightHand.x);
      djFilterCutoff = filter.cutoff;
      djFilterType = filter.type;
    }

    const state: GestureState = {
      leftHand,
      rightHand,
      isDualFist,
      djFilterCutoff,
      djFilterType,
    };

    return {
      state,
      rawLandmarks,
    };
  }

  /**
   * Stops real-time tracking animation loop and releases video element reference.
   */
  public stopTracking(): void {
    this.isTrackingState = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.videoElement = null;
    this.onFrameCallback = null;
    this.previousLandmarks.clear();
  }

  /**
   * Returns whether tracker has an active HandLandmarker instance.
   */
  public isReady(): boolean {
    return this.landmarker !== null;
  }

  /**
   * Returns whether tracker is currently tracking video frames.
   */
  public isTracking(): boolean {
    return this.isTrackingState;
  }

  /**
   * Returns active HandLandmarker instance.
   */
  public getLandmarker(): HandLandmarker | null {
    return this.landmarker;
  }

  /**
   * Disposes of HandLandmarker instance and WebGL/WASM resources.
   */
  public dispose(): void {
    this.stopTracking();
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch {}
      this.landmarker = null;
    }
  }
}
