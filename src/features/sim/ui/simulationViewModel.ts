import { RiskEvents } from '../../../core/sim/types';
import { SensitivityItem } from '../worker/protocol';

interface PercentilePoint {
  dayOffset?: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface DriverInsight {
  key: string;
  titleKey: 'simulationDriverThreshold' | 'simulationDriverUncertainty' | 'simulationDriverRisk';
  summaryKey: 'simulationDriverThresholdSummary' | 'simulationDriverUncertaintySummary' | 'simulationDriverRiskSummary';
  strengthKey: 'simulationDriverStrengthStrong' | 'simulationDriverStrengthMedium' | 'simulationDriverStrengthWeak';
  indicator: string;
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

export function formatAdaptive(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100) return `${Math.round(value)}`;
  const rounded = Math.round(value * 10) / 10;
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) return `${Math.round(rounded)}`;
  return rounded.toFixed(1);
}

export function findFailureWindow(points: FanPoint[], threshold: number, horizonMonths?: number): { fromMonth: number; toMonth: number } | null {
  const failing = points.filter((point) => point.p50 < threshold).map((point) => point.month);
  if (failing.length === 0) return null;
  const safeHorizon = typeof horizonMonths === 'number' ? Math.max(1, Math.round(horizonMonths)) : null;
  const fromMonth = safeHorizon == null ? failing[0] : Math.min(failing[0], safeHorizon);
  const toMonthRaw = failing[failing.length - 1];
  return {
    fromMonth,
    toMonth: safeHorizon == null ? toMonthRaw : Math.min(toMonthRaw, safeHorizon)
  };
}

function toStrength(score: number): DriverInsight['strengthKey'] {
  if (score >= 3) return 'simulationDriverStrengthStrong';
  if (score >= 2) return 'simulationDriverStrengthMedium';
  return 'simulationDriverStrengthWeak';
}

export function buildDrivers(levers: SensitivityItem[]): DriverInsight[] {
  const unique = levers
    .filter((lever) => Math.abs(lever.successDelta) + Math.abs(lever.drawdownDelta) > 0)
    .filter((lever, index, source) => source.findIndex((item) => item.lever === lever.lever) === index)
    .slice(0, 3);

  return unique.map((lever, index) => {
    const key = `${lever.lever}-${index}`;
    if (lever.lever === 'uncertainty') {
      return {
        key,
        titleKey: 'simulationDriverUncertainty',
        summaryKey: 'simulationDriverUncertaintySummary',
        strengthKey: toStrength(lever.score),
        indicator: `${formatSignedTenthsAsPercent(lever.successDelta)} / ${formatSignedPercent(lever.drawdownDelta)}`
      };
    }
    if (lever.lever === 'riskAppetite') {
      return {
        key,
        titleKey: 'simulationDriverRisk',
        summaryKey: 'simulationDriverRiskSummary',
        strengthKey: toStrength(lever.score),
        indicator: `${formatSignedTenthsAsPercent(lever.successDelta)} / ${formatSignedPercent(lever.drawdownDelta)}`
      };
    }
    return {
      key,
      titleKey: 'simulationDriverThreshold',
      summaryKey: 'simulationDriverThresholdSummary',
      strengthKey: toStrength(lever.score),
      indicator: `${formatSignedTenthsAsPercent(lever.successDelta)} / ${formatSignedPercent(lever.drawdownDelta)}`
    };
  });
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

export function buildFanPoints(trajectory: PercentilePoint[], horizonMonths: number): FanPoint[] {
  const safeHorizon = Math.max(1, Math.round(horizonMonths));
  return trajectory.map((point, index) => {
    const rawMonth = point.dayOffset != null
      ? Math.max(1, Math.ceil(point.dayOffset / 30))
      : Math.max(1, Math.round(((index + 1) / Math.max(1, trajectory.length)) * safeHorizon));
    const month = Math.min(safeHorizon, rawMonth);
    const lowerSpan = point.p50 - point.p10;
    const upperSpan = point.p90 - point.p50;
    return {
      month,
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
