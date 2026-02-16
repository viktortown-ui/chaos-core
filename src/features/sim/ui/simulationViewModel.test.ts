import { describe, expect, it } from 'vitest';
import { buildDistributionBars, buildFanPoints, buildHeadroomChipModel, buildRiskDisplayMetric, buildSpreadChipModel, formatMonthTick, heroStatusLabel, nearestDiscreteLevel, rankLevers, riskCostLineKey, strategicLeverTitleKey, togglePin } from './simulationViewModel';

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

  it('maps hero status to 3-state labels', () => {
    expect(heroStatusLabel(2)).toBe('simulationHeroStatusFail');
    expect(heroStatusLabel(5)).toBe('simulationHeroStatusEdge');
    expect(heroStatusLabel(7)).toBe('simulationHeroStatusSuccess');
  });

  it('builds human chips for headroom/spread/risk tone', () => {
    expect(buildHeadroomChipModel(58)).toMatchObject({ value: '+58', tone: 'positive', icon: '▲' });
    expect(buildHeadroomChipModel(-472)).toMatchObject({ value: '−472', tone: 'negative', icon: '▼' });
    expect(buildSpreadChipModel(5)).toEqual({ fan: 1, helpKey: 'simulationSpreadHelpNarrow' });
    expect(buildSpreadChipModel(95)).toEqual({ fan: 10, helpKey: 'simulationSpreadHelpWide' });
    expect(riskCostLineKey(1)).toBe('simulationRiskCostLineLow');
    expect(riskCostLineKey(3)).toBe('simulationRiskCostLineHigh');
  });



  it('builds fan quantiles and distribution bars', () => {
    const fan = buildFanPoints([{ dayOffset: 30, p10: 80, p50: 100, p90: 140 }], 12);
    expect(fan[0]).toMatchObject({ month: 1, p25: 90, p75: 120 });
    const bars = buildDistributionBars([10, 20, 30], [5, 10]);
    expect(bars[1]).toMatchObject({ heightPct: 100, edgeLeft: 20, edgeRight: 30 });
  });

  it('ranks and labels strategic levers deterministically', () => {
    const ranked = rankLevers([
      { lever: 'strategy', labelKey: 'leverStrategy', successDelta: 1, drawdownDelta: -1, cost: 0.5, score: 1, nextConfig: {} },
      { lever: 'horizon', labelKey: 'leverHorizon', successDelta: 2, drawdownDelta: -4, cost: 0.2, score: 2, nextConfig: {} },
      { lever: 'riskAppetite', labelKey: 'leverRiskAppetite', successDelta: 1, drawdownDelta: -2, cost: 0.2, score: 4, nextConfig: {} }
    ] as never);
    expect(ranked[0].lever).toBe('horizon');
    expect(strategicLeverTitleKey(0)).toBe('simulationLeverCheapest');
    expect(strategicLeverTitleKey(1)).toBe('simulationLeverFastest');
    expect(strategicLeverTitleKey(2)).toBe('simulationLeverSafest');
  });
});
