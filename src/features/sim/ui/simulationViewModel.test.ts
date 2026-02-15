import { describe, expect, it } from 'vitest';
import { buildRiskDisplayMetric, formatMonthTick, nearestDiscreteLevel, togglePin } from './simulationViewModel';

describe('simulation view model helpers', () => {
  it('formats x-axis as months and never 1970 date labels', () => {
    expect(formatMonthTick(1)).toBe('М1');
    expect(formatMonthTick(4)).toBe('М4');
    expect(formatMonthTick(2)).toBe('');
    expect(formatMonthTick(40)).not.toContain('1970');
  });

  it('computes risk metrics with bounded share and avg per world', () => {
    const metric = buildRiskDisplayMetric({ worldsWithEvent: 12500, totalEvents: 49000 }, 10000);
    expect(metric.shareOfWorldsPct).toBe(100);
    expect(metric.avgPerWorld).toBe(4.9);
  });

  it('toggles pin deterministically', () => {
    expect(togglePin(null, 5)).toBe(5);
    expect(togglePin(5, 5)).toBeNull();
    expect(togglePin(5, 7)).toBe(7);
  });

  it('maps slider values to discrete levels', () => {
    expect(nearestDiscreteLevel(0.34)).toBe(1);
    expect(nearestDiscreteLevel(0.56)).toBe(2);
  });
});
