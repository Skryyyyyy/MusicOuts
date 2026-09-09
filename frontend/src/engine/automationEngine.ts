import {
  AutomationPoint,
  AutomationLane,
  PerformanceCaptureEvent,
  PerformanceSession,
  MusicOutsProject,
} from '../types';

export const DEFAULT_AUTOMATION_LANES: Omit<AutomationLane, 'points'>[] = [
  { target: 'vocals.volume', name: 'Vocals Level', color: '#06b6d4', min: 0, max: 1.5, isArmed: true, isEnabled: true },
  { target: 'drums.volume', name: 'Drums Level', color: '#f97316', min: 0, max: 1.5, isArmed: false, isEnabled: true },
  { target: 'bass.volume', name: 'Bass Level', color: '#a855f7', min: 0, max: 1.5, isArmed: false, isEnabled: true },
  { target: 'other.volume', name: 'Other Level', color: '#10b981', min: 0, max: 1.5, isArmed: false, isEnabled: true },
  { target: 'master.djFilterCutoff', name: 'DJ Filter Cutoff', color: '#ec4899', min: 20, max: 20000, isArmed: true, isEnabled: true },
  { target: 'vocals.pan', name: 'Vocals Pan', color: '#38bdf8', min: -1, max: 1, isArmed: false, isEnabled: true },
  { target: 'vocals.reverbMix', name: 'Vocals Reverb', color: '#e879f9', min: 0, max: 1, isArmed: false, isEnabled: true },
  { target: 'other.delayMix', name: 'Other Delay', color: '#fbbf24', min: 0, max: 1, isArmed: false, isEnabled: true },
];

export class AutomationManager {
  private points: AutomationPoint[] = [];
  private isRecordingState: boolean = false;
  private lastRecordTimes: Map<string, number> = new Map();
  private recordThrottleMs: number = 40; // max 25 points/sec per param

  constructor(initialPoints: AutomationPoint[] = []) {
    this.points = [...initialPoints];
  }

  public setRecording(recording: boolean): void {
    this.isRecordingState = recording;
    if (!recording) {
      this.lastRecordTimes.clear();
      this.sortPoints();
    }
  }

  public isRecording(): boolean {
    return this.isRecordingState;
  }

  /**
   * Record a parameter value at a specific timeline timestamp
   */
  public recordPoint(time: number, target: string, value: number): void {
    if (!this.isRecordingState || time < 0) return;

    const now = performance.now();
    const lastTime = this.lastRecordTimes.get(target) || 0;
    if (now - lastTime < this.recordThrottleMs) {
      return;
    }
    this.lastRecordTimes.set(target, now);

    // Remove any existing point at the exact same sub-second slot
    this.points = this.points.filter(
      (p) => !(p.target === target && Math.abs(p.time - time) < 0.03)
    );

    this.points.push({
      id: `auto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      time: Math.round(time * 1000) / 1000,
      target,
      value: Math.round(value * 1000) / 1000,
    });
  }

  public addPoint(point: AutomationPoint): void {
    this.points.push(point);
    this.sortPoints();
  }

  public deletePoint(pointId: string): void {
    this.points = this.points.filter((p) => p.id !== pointId);
  }

  public clearTarget(target: string): void {
    this.points = this.points.filter((p) => p.target !== target);
  }

  public clearAll(): void {
    this.points = [];
  }

  public getPoints(target?: string): AutomationPoint[] {
    if (target) {
      return this.points.filter((p) => p.target === target);
    }
    return [...this.points];
  }

  public setPoints(points: AutomationPoint[]): void {
    this.points = [...points];
    this.sortPoints();
  }

  /**
   * Interpolate values at timestamp t
   */
  public evaluateAt(time: number): Record<string, number> {
    if (this.points.length === 0) return {};

    const targets = new Set(this.points.map((p) => p.target));
    const result: Record<string, number> = {};

    for (const target of targets) {
      const targetPoints = this.points
        .filter((p) => p.target === target)
        .sort((a, b) => a.time - b.time);

      if (targetPoints.length === 0) continue;

      if (time <= targetPoints[0].time) {
        result[target] = targetPoints[0].value;
        continue;
      }

      if (time >= targetPoints[targetPoints.length - 1].time) {
        result[target] = targetPoints[targetPoints.length - 1].value;
        continue;
      }

      // Find bounding interval
      let pBefore = targetPoints[0];
      let pAfter = targetPoints[targetPoints.length - 1];

      for (let i = 0; i < targetPoints.length - 1; i++) {
        if (time >= targetPoints[i].time && time <= targetPoints[i + 1].time) {
          pBefore = targetPoints[i];
          pAfter = targetPoints[i + 1];
          break;
        }
      }

      const duration = pAfter.time - pBefore.time;
      if (duration === 0) {
        result[target] = pBefore.value;
      } else {
        const factor = (time - pBefore.time) / duration;
        result[target] = pBefore.value + (pAfter.value - pBefore.value) * factor;
      }
    }

    return result;
  }

  private sortPoints(): void {
    this.points.sort((a, b) => a.time - b.time);
  }
}

// ---------------- PERFORMANCE CAPTURE TRACKER ----------------

export class PerformanceCaptureTracker {
  private isCapturingState: boolean = false;
  private captureStartTime: number = 0;
  private events: PerformanceCaptureEvent[] = [];
  private scenesTriggered: Set<string> = new Set();
  private initialProject: MusicOutsProject | null = null;

  public startCapture(project: MusicOutsProject): void {
    this.isCapturingState = true;
    this.captureStartTime = Date.now();
    this.events = [];
    this.scenesTriggered = new Set();
    this.initialProject = JSON.parse(JSON.stringify(project));
  }

  public isCapturing(): boolean {
    return this.isCapturingState;
  }

  public logEvent(
    time: number,
    type: 'gesture' | 'fader' | 'filter' | 'scene' | 'fx',
    data: Record<string, unknown>
  ): void {
    if (!this.isCapturingState) return;

    if (type === 'scene' && typeof data.sceneName === 'string') {
      this.scenesTriggered.add(data.sceneName);
    }

    this.events.push({
      time: Math.round(time * 100) / 100,
      type,
      data,
    });
  }

  public stopCapture(finalProject: MusicOutsProject): PerformanceSession | null {
    if (!this.isCapturingState || !this.initialProject) return null;

    this.isCapturingState = false;
    const durationSeconds = Math.round((Date.now() - this.captureStartTime) / 1000);

    const gesturePoints = this.events.filter((e) => e.type === 'gesture').length;
    const automationCount = this.events.filter((e) => e.type === 'fader' || e.type === 'filter' || e.type === 'fx').length;

    const session: PerformanceSession = {
      id: `perf_${Date.now()}`,
      title: `${finalProject.title || 'Live'} Performance Take`,
      timestamp: new Date().toISOString(),
      duration: durationSeconds,
      totalGestures: gesturePoints,
      totalAutomationPoints: automationCount,
      scenesTriggered: Array.from(this.scenesTriggered),
      events: [...this.events],
      projectSnapshot: JSON.parse(JSON.stringify(finalProject)),
    };

    return session;
  }
}
