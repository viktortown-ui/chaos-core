import { describe, expect, it } from 'vitest';
import { runMonteCarlo } from './monteCarlo';

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
});
