import { describe, expect, it } from 'vitest';
import { quantileSorted, runMonteCarlo } from './monteCarlo';

describe('runMonteCarlo deterministic seed', () => {
  it('returns deterministic output for fixed seed', () => {
    const config = {
      runs: 500,
      horizonMonths: 12,
      dtDays: 5,
      baseState: { capital: 100, resilience: 30, momentum: 25, stress: 20 },
      actionPolicy: () => ({ strategy: 'balance' as const, riskBias: 0.5, uncertaintyBias: 0.4 }),
      scenarioParams: {
        seed: 111,
        uncertainty: 0.5,
        riskAppetite: 0.5,
        blackSwanEnabled: true,
        blackSwanChanceMonthly: 0.03,
        blackSwanImpact: 1.1
      }
    };

    const first = runMonteCarlo(config);
    const second = runMonteCarlo(config);

    expect(second.scorePercentiles).toEqual(first.scorePercentiles);
    expect(second.successRatio).toBe(first.successRatio);
    expect(second.riskEvents).toEqual(first.riskEvents);
    expect(second.endingScore.bins).toEqual(first.endingScore.bins);
  });

  it('preserves percentile order and chance math', () => {
    const result = runMonteCarlo({
      runs: 1000,
      horizonMonths: 12,
      dtDays: 5,
      baseState: { capital: 95, resilience: 25, momentum: 24, stress: 17 },
      actionPolicy: () => ({ strategy: 'balance' as const, riskBias: 0.6, uncertaintyBias: 0.5 }),
      scenarioParams: { seed: 222, uncertainty: 0.6, riskAppetite: 0.5, blackSwanEnabled: true, blackSwanChanceMonthly: 0.03, blackSwanImpact: 1.1 }
    });

    expect(result.scorePercentiles.p10).toBeLessThanOrEqual(result.scorePercentiles.p50);
    expect(result.scorePercentiles.p50).toBeLessThanOrEqual(result.scorePercentiles.p90);
    const successWorlds = Math.round(result.successRatio * result.runs);
    expect(result.successRatio).toBeCloseTo(successWorlds / result.runs, 2);
  });

  it('widens spread when fog is increased', () => {
    const base = {
      runs: 1500,
      horizonMonths: 12,
      dtDays: 5,
      baseState: { capital: 100, resilience: 30, momentum: 26, stress: 16 },
      actionPolicy: () => ({ strategy: 'balance' as const, riskBias: 0.5, uncertaintyBias: 0.4 }),
      scenarioParams: { seed: 333, uncertainty: 0.2, riskAppetite: 0.5, blackSwanEnabled: true, blackSwanChanceMonthly: 0.03, blackSwanImpact: 1.1 }
    };

    const lowFog = runMonteCarlo(base);
    const highFog = runMonteCarlo({ ...base, scenarioParams: { ...base.scenarioParams, seed: 334, uncertainty: 1 } });
    const spreadLow = lowFog.scorePercentiles.p90 - lowFog.scorePercentiles.p10;
    const spreadHigh = highFog.scorePercentiles.p90 - highFog.scorePercentiles.p10;
    expect(spreadHigh).toBeGreaterThan(spreadLow);
  });

  it('courage shifts median upward', () => {
    const base = {
      runs: 1800,
      horizonMonths: 12,
      dtDays: 5,
      baseState: { capital: 100, resilience: 30, momentum: 26, stress: 16 },
      actionPolicy: () => ({ strategy: 'balance' as const, riskBias: 0.4, uncertaintyBias: 0.5 }),
      scenarioParams: { seed: 555, uncertainty: 0.5, riskAppetite: 0.2, blackSwanEnabled: true, blackSwanChanceMonthly: 0.03, blackSwanImpact: 1.1 }
    };

    const lowCourage = runMonteCarlo(base);
    const highCourage = runMonteCarlo({ ...base, scenarioParams: { ...base.scenarioParams, seed: 556, riskAppetite: 1 } });
    expect(highCourage.scorePercentiles.p50).toBeGreaterThanOrEqual(lowCourage.scorePercentiles.p50);
  });

  it('black swan hurts lower tail', () => {
    const base = {
      runs: 1500,
      horizonMonths: 12,
      dtDays: 5,
      baseState: { capital: 100, resilience: 30, momentum: 26, stress: 16 },
      actionPolicy: () => ({ strategy: 'balance' as const, riskBias: 0.6, uncertaintyBias: 0.5 }),
      scenarioParams: { seed: 444, uncertainty: 0.6, riskAppetite: 0.5, blackSwanEnabled: false, blackSwanChanceMonthly: 0.05, blackSwanImpact: 1.2 }
    };

    const noSwan = runMonteCarlo(base);
    const withSwan = runMonteCarlo({ ...base, scenarioParams: { ...base.scenarioParams, seed: 445, blackSwanEnabled: true } });
    expect(withSwan.scorePercentiles.p10).toBeLessThanOrEqual(noSwan.scorePercentiles.p10);
  });

  it('lower threshold raises success chance', () => {
    const common = {
      runs: 1800,
      horizonMonths: 12,
      dtDays: 5,
      baseState: { capital: 98, resilience: 28, momentum: 24, stress: 18 },
      actionPolicy: () => ({ strategy: 'balance' as const, riskBias: 0.5, uncertaintyBias: 0.5 }),
      scenarioParams: { seed: 666, uncertainty: 0.5, riskAppetite: 0.5, blackSwanEnabled: true, blackSwanChanceMonthly: 0.03, blackSwanImpact: 1.1 }
    };

    const highThreshold = runMonteCarlo({ ...common, successThreshold: 140 });
    const lowThreshold = runMonteCarlo({ ...common, successThreshold: 110 });
    expect(lowThreshold.successRatio).toBeGreaterThanOrEqual(highThreshold.successRatio);
  });


  it('calculates quantiles with interpolation', () => {
    const sorted = [-10, 0, 10, 20, 40];
    expect(quantileSorted(sorted, 0.1)).toBe(-6);
    expect(quantileSorted(sorted, 0.5)).toBe(10);
    expect(quantileSorted(sorted, 0.9)).toBe(32);
  });

  it('uses success criterion final score >= threshold', () => {
    const result = runMonteCarlo({
      runs: 500,
      horizonMonths: 6,
      dtDays: 5,
      baseState: { capital: 100, resilience: 30, momentum: 25, stress: 18 },
      actionPolicy: () => ({ strategy: 'balance' as const, riskBias: 0.5, uncertaintyBias: 0.4 }),
      scenarioParams: { seed: 700, uncertainty: 0.5, riskAppetite: 0.5, blackSwanEnabled: true, blackSwanChanceMonthly: 0.03, blackSwanImpact: 1.1 },
      successThreshold: Number.POSITIVE_INFINITY
    });
    expect(result.successRatio).toBe(0);
  });
});
