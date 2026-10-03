import { KeyframeLane } from '../project-model/types';

/**
 * Keyframe Automation Evaluator
 * Evaluates parameter curves sample-accurately or at arbitrary timestamps.
 */

// Solve cubic bezier value y given x (normalized time 0..1)
function cubicBezier(
  t: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number
): number {
  // Approximate with de Casteljau / cubic polynomial
  // For audio curves, a standard cubic ease formula:
  const cx = 3.0 * p1x;
  const bx = 3.0 * (p2x - p1x) - cx;
  const ax = 1.0 - cx - bx;

  const cy = 3.0 * p1y;
  const by = 3.0 * (p2y - p1y) - cy;
  const ay = 1.0 - cy - by;

  // Newton-Raphson to solve for unit time t given x
  let currentT = t;
  for (let i = 0; i < 5; i++) {
    const currentX = ((ax * currentT + bx) * currentT + cx) * currentT;
    const dx = (3.0 * ax * currentT + 2.0 * bx) * currentT + cx;
    if (Math.abs(dx) < 1e-6) break;
    currentT -= (currentX - t) / dx;
    currentT = Math.max(0, Math.min(1, currentT));
  }

  return ((ay * currentT + by) * currentT + cy) * currentT;
}

/**
 * Evaluates the value of a keyframe lane at a given time in seconds.
 */
export function evaluateKeyframe(lane: KeyframeLane, time: number): number {
  if (!lane.points || lane.points.length === 0) {
    return lane.defaultValue;
  }

  // Sorted points by time
  const points = [...lane.points].sort((a, b) => a.time - b.time);

  // If before first keyframe
  if (time <= points[0].time) {
    return points[0].value;
  }

  // If after last keyframe
  if (time >= points[points.length - 1].time) {
    return points[points.length - 1].value;
  }

  // Find surrounding keyframes
  let prev = points[0];
  let next = points[1];

  for (let i = 0; i < points.length - 1; i++) {
    if (time >= points[i].time && time <= points[i + 1].time) {
      prev = points[i];
      next = points[i + 1];
      break;
    }
  }

  const duration = next.time - prev.time;
  if (duration <= 0.00001) {
    return next.value;
  }

  const normalizedT = (time - prev.time) / duration;

  switch (prev.curve) {
    case 'hold':
      return prev.value;

    case 'ease': {
      // Smooth sinusoidal ease-in-out
      const easeT = (1 - Math.cos(normalizedT * Math.PI)) / 2;
      return prev.value + (next.value - prev.value) * easeT;
    }

    case 'bezier': {
      const p1x = prev.controlPointOut?.x ?? 0.42;
      const p1y = prev.controlPointOut?.y ?? 0.0;
      const p2x = next.controlPointIn?.x ?? 0.58;
      const p2y = next.controlPointIn?.y ?? 1.0;
      const bezierT = cubicBezier(normalizedT, p1x, p1y, p2x, p2y);
      return prev.value + (next.value - prev.value) * bezierT;
    }

    case 'linear':
    default:
      return prev.value + (next.value - prev.value) * normalizedT;
  }
}

/**
 * Clamp a parameter value within its lane bounds
 */
export function clampLaneValue(lane: KeyframeLane, value: number): number {
  return Math.max(lane.minValue, Math.min(lane.maxValue, value));
}
