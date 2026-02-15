export type StrategyMode = 'attack' | 'balance' | 'defense';

export interface StateVector {
  capital: number;
  resilience: number;
  momentum: number;
  stress: number;
}

export interface Action {
  strategy: StrategyMode;
  riskBias: number;
  uncertaintyBias: number;
}

export interface ScenarioParams {
  seed: number;
  uncertainty: number;
  riskAppetite: number;
  blackSwanEnabled: boolean;
  blackSwanChanceMonthly: number;
  blackSwanImpact: number;
}

export interface Distribution {
  binEdges: number[];
  bins: number[];
  min: number;
  max: number;
  mean: number;
}

export interface Percentiles {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface RiskEventMetric {
  worldsWithEvent: number;
  totalEvents: number;
}

export interface RiskEvents {
  stressBreaks: RiskEventMetric;
  drawdownsOver20: RiskEventMetric;
  blackSwans: RiskEventMetric;
}

export interface TrajectoryPoint {
  dayOffset: number;
  p10: number;
  p50: number;
  p90: number;
}

export type LeverKey = 'riskAppetite' | 'uncertainty' | 'strategy' | 'horizon' | 'blackSwanShield';

export interface SimulationResult {
  runs: number;
  horizonMonths: number;
  dtDays: number;
  endingCapital: Distribution;
  endingResilience: Distribution;
  endingScore: Distribution;
  scorePercentiles: Percentiles;
  scoreTrajectory: TrajectoryPoint[];
  endingScoresRaw: number[];
  successRatio: number;
  riskEvents: RiskEvents;
  topLevers: LeverKey[];
}

export interface MonteCarloConfig {
  runs?: number;
  horizonMonths: number;
  dtDays: number;
  baseState: StateVector;
  actionPolicy: (state: StateVector, stepIndex: number) => Action;
  scenarioParams: ScenarioParams;
  successThreshold?: number;
  progressEvery?: number;
  onProgress?: (completedRuns: number, partialResult: SimulationResult) => void;
  shouldAbort?: () => boolean;
}
