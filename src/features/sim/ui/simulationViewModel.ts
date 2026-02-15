import { RiskEvents } from '../../../core/sim/types';

export const DISCRETE_LEVEL_VALUES = [0.2, 0.4, 0.6, 0.8, 1] as const;

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function formatMonthTick(value: number): string {
  const month = Math.max(1, Math.round(value));
  return month % 3 === 1 ? `М${month}` : '';
}

export function nearestDiscreteLevel(value: number): number {
  let bestIndex = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  DISCRETE_LEVEL_VALUES.forEach((candidate, index) => {
    const delta = Math.abs(candidate - value);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  });
  return bestIndex;
}

export function togglePin(currentPinned: number | null, tapped: number): number | null {
  return currentPinned === tapped ? null : tapped;
}

export function mapRawToHumanIndex(rawScore: number, low: number, high: number): number {
  const spread = Math.max(1, high - low);
  const normalized = ((rawScore - low) / spread) * 100;
  return Math.round(Math.max(0, Math.min(100, normalized)));
}

export function successMeterLabel(value: number): 'simulationStatusFail' | 'simulationStatusEdge' | 'simulationStatusHolding' | 'simulationStatusStable' | 'simulationStatusStrong' {
  if (value <= 1) return 'simulationStatusFail';
  if (value <= 3) return 'simulationStatusEdge';
  if (value <= 6) return 'simulationStatusHolding';
  if (value <= 8) return 'simulationStatusStable';
  return 'simulationStatusStrong';
}

export function heroStatusLabel(value: number): 'simulationHeroStatusFail' | 'simulationHeroStatusEdge' | 'simulationHeroStatusSuccess' {
  if (value <= 3) return 'simulationHeroStatusFail';
  if (value <= 6) return 'simulationHeroStatusEdge';
  return 'simulationHeroStatusSuccess';
}

export function uncertaintyEffectKey(level: number): 'simulationFutureFanNarrow' | 'simulationFutureFanMedium' | 'simulationFutureFanWide' {
  if (level <= 1) return 'simulationFutureFanNarrow';
  if (level <= 3) return 'simulationFutureFanMedium';
  return 'simulationFutureFanWide';
}

export function riskEffectKey(level: number): 'simulationRiskPriceFrequent' | 'simulationRiskPriceRare' {
  return level >= 3 ? 'simulationRiskPriceFrequent' : 'simulationRiskPriceRare';
}

export interface RiskDisplayMetric {
  shareOfWorldsPct: number;
  worldsWithEvent: number;
  avgPerWorld: number;
  totalEvents: number;
}

export function buildRiskDisplayMetric(metric: RiskEvents[keyof RiskEvents], runs: number): RiskDisplayMetric {
  const safeRuns = Math.max(1, runs);
  const worldsWithEvent = Math.max(0, metric.worldsWithEvent);
  const totalEvents = Math.max(0, metric.totalEvents);
  return {
    shareOfWorldsPct: clampPercent((worldsWithEvent / safeRuns) * 100),
    worldsWithEvent,
    avgPerWorld: totalEvents / safeRuns,
    totalEvents
  };
}
