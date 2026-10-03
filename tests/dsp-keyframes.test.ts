import { describe, it, expect } from 'vitest';
import { evaluateKeyframe } from '../core/dsp/keyframes';
import { KeyframeLane } from '../core/project-model/types';

describe('Keyframe Automation Evaluator', () => {
  const linearLane: KeyframeLane = {
    id: 'lane-1',
    parameter: 'volume',
    displayName: 'Volume',
    color: '#38BDF8',
    defaultValue: 1.0,
    minValue: 0.0,
    maxValue: 2.0,
    unit: 'gain',
    points: [
      { id: 'p1', time: 0.0, value: 0.0, curve: 'linear' },
      { id: 'p2', time: 10.0, value: 1.0, curve: 'linear' },
    ],
  };

  it('interpolates linearly between keyframe points', () => {
    expect(evaluateKeyframe(linearLane, 0.0)).toBeCloseTo(0.0);
    expect(evaluateKeyframe(linearLane, 5.0)).toBeCloseTo(0.5);
    expect(evaluateKeyframe(linearLane, 10.0)).toBeCloseTo(1.0);
  });

  it('clamps to boundary values before and after keyframes', () => {
    expect(evaluateKeyframe(linearLane, -5.0)).toBeCloseTo(0.0);
    expect(evaluateKeyframe(linearLane, 15.0)).toBeCloseTo(1.0);
  });

  it('supports hold curves', () => {
    const holdLane: KeyframeLane = {
      ...linearLane,
      points: [
        { id: 'p1', time: 0.0, value: 0.2, curve: 'hold' },
        { id: 'p2', time: 5.0, value: 0.8, curve: 'hold' },
      ],
    };

    expect(evaluateKeyframe(holdLane, 2.5)).toBeCloseTo(0.2);
    expect(evaluateKeyframe(holdLane, 5.0)).toBeCloseTo(0.8);
  });

  it('supports smooth ease curves', () => {
    const easeLane: KeyframeLane = {
      ...linearLane,
      points: [
        { id: 'p1', time: 0.0, value: 0.0, curve: 'ease' },
        { id: 'p2', time: 10.0, value: 1.0, curve: 'ease' },
      ],
    };

    const midValue = evaluateKeyframe(easeLane, 5.0);
    expect(midValue).toBeCloseTo(0.5);
    // Ease curve has slower slope at start
    const earlyValue = evaluateKeyframe(easeLane, 2.0);
    expect(earlyValue).toBeLessThan(0.2); // Slower start than linear (0.2)
  });
});
