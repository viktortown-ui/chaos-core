import { RiskEvents } from '../../../core/sim/types';
import { SensitivityItem } from '../worker/protocol';

interface PercentilePoint {
  p10: number;
  p50: number;
  p90: number;
}

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

export interface HeadroomChipModel {
  value: string;
  stateKey: 'simulationChipHeadroomStatePositive' | 'simulationChipHeadroomStateNegative';
  helpKey: 'simulationChipHeadroomHelpPos' | 'simulationChipHeadroomHelpNeg';
  tone: 'positive' | 'negative';
  icon: '▲' | '▼';
  fuelKey: 'simulationFuelPositive' | 'simulationFuelNegative';
}

export function buildHeadroomChipModel(headroom: number): HeadroomChipModel {
  const normalized = Math.round(headroom);
  if (normalized >= 0) {
    return {
      value: `+${normalized}`,
      stateKey: 'simulationChipHeadroomStatePositive',
      helpKey: 'simulationChipHeadroomHelpPos',
      tone: 'positive',
      icon: '▲',
      fuelKey: 'simulationFuelPositive'
    };
  }

  return {
    value: `−${Math.abs(normalized)}`,
    stateKey: 'simulationChipHeadroomStateNegative',
    helpKey: 'simulationChipHeadroomHelpNeg',
    tone: 'negative',
    icon: '▼',
    fuelKey: 'simulationFuelNegative'
  };
}

export interface SpreadChipModel {
  fan: number;
  helpKey: 'simulationSpreadHelpNarrow' | 'simulationSpreadHelpWide';
}

export function buildSpreadChipModel(spread: number): SpreadChipModel {
  const fan = Math.max(0, Math.min(10, Math.round(spread / 10)));
  return {
    fan,
    helpKey: fan <= 4 ? 'simulationSpreadHelpNarrow' : 'simulationSpreadHelpWide'
  };
}

export function riskCostLineKey(level: number): 'simulationRiskCostLineLow' | 'simulationRiskCostLineHigh' {
  return level >= 3 ? 'simulationRiskCostLineHigh' : 'simulationRiskCostLineLow';
}

export function strategicLeverTitleKey(index: number): 'simulationLeverCheapest' | 'simulationLeverFastest' | 'simulationLeverSafest' {
  if (index === 1) return 'simulationLeverFastest';
  if (index === 2) return 'simulationLeverSafest';
  return 'simulationLeverCheapest';
}

export function formatSignedPercent(value: number): string {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? '+' : ''}${rounded}%`;
}

export function formatSignedTenthsAsPercent(value: number): string {
  const asPercent = Math.round(value * 10);
  return `${asPercent >= 0 ? '+' : ''}${asPercent}%`;
}

export function buildOraclePins(length: number, pinnedIndex: number | null): number[] {
  if (length <= 0) return [];
  const points = new Set<number>([0, Math.max(0, Math.round(length * 0.5) - 1), length - 1]);
  if (pinnedIndex != null) points.add(Math.max(0, Math.min(length - 1, pinnedIndex)));
  return Array.from(points).sort((a, b) => a - b);
}

export function rankLevers(levers: SensitivityItem[]): SensitivityItem[] {
  return levers
    .slice()
    .sort((left, right) => {
      if (left.cost !== right.cost) return left.cost - right.cost;
      if (left.successDelta !== right.successDelta) return right.successDelta - left.successDelta;
      return left.drawdownDelta - right.drawdownDelta;
    });
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

export interface FanPoint {
  month: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export function buildFanPoints(trajectory: PercentilePoint[]): FanPoint[] {
  return trajectory.map((point, index) => {
    const lowerSpan = point.p50 - point.p10;
    const upperSpan = point.p90 - point.p50;
    return {
      month: index + 1,
      p10: point.p10,
      p25: point.p10 + lowerSpan * 0.5,
      p50: point.p50,
      p75: point.p50 + upperSpan * 0.5,
      p90: point.p90
    };
  });
}

export interface HudMetric {
  labelKey: 'simulationHudSuccess' | 'simulationHudMedian' | 'simulationHudP10' | 'simulationHudDrawdown';
  value: string;
  subtextKey: 'simulationHudSuccessSub' | 'simulationHudMedianSub' | 'simulationHudP10Sub' | 'simulationHudDrawdownSub';
  quipKey: 'simulationHudQuipProbability' | 'simulationHudQuipThreshold' | 'simulationHudQuipNoise' | 'simulationHudQuipRisk';
  icon: string;
}

export interface DistributionBar {
  index: number;
  heightPct: number;
  edgeLeft: number;
  edgeRight: number;
}

export function buildDistributionBars(binEdges: number[], bins: number[]): DistributionBar[] {
  const max = Math.max(...bins, 1);
  return bins.map((bin, index) => ({
    index,
    heightPct: (bin / max) * 100,
    edgeLeft: binEdges[index] ?? index,
    edgeRight: binEdges[index + 1] ?? (binEdges[index] ?? index) + 1
  }));
}
