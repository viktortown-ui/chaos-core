import { createRng } from './rng';
import { scoreState, step } from './model';
import { Distribution, LeverKey, MonteCarloConfig, Percentiles, SimulationResult, TrajectoryPoint } from './types';

const DEFAULT_RUNS = 10_000;
const DEFAULT_BATCH = 250;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * p;
  const floor = Math.floor(index);
  const ceil = Math.ceil(index);
  if (floor === ceil) return sorted[floor];
  const t = index - floor;
  return sorted[floor] + (sorted[ceil] - sorted[floor]) * t;
}

function buildDistribution(values: number[], binsCount = 20): Distribution {
  if (values.length === 0) {
    return { binEdges: [0], bins: [0], min: 0, max: 0, mean: 0 };
  }
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  values.forEach((value) => {
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
  });

  const spread = Math.max(1e-6, max - min);
  const binSize = spread / binsCount;
  const bins = Array.from({ length: binsCount }, () => 0);
  const edges = Array.from({ length: binsCount + 1 }, (_, index) => min + index * binSize);

  values.forEach((value) => {
    const idx = Math.min(binsCount - 1, Math.floor((value - min) / binSize));
    bins[idx] += 1;
  });

  return {
    binEdges: edges,
    bins,
    min,
    max,
    mean: sum / values.length
  };
}

function emptyResult(horizonMonths: number, dtDays: number): SimulationResult {
  return {
    runs: 0,
    horizonMonths,
    dtDays,
    endingCapital: buildDistribution([]),
    endingResilience: buildDistribution([]),
    endingScore: buildDistribution([]),
    scorePercentiles: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 },
    scoreTrajectory: [],
    endingScoresRaw: [],
    successRatio: 0,
    riskEvents: {
      stressBreaks: { worldsWithEvent: 0, totalEvents: 0 },
      drawdownsOver20: { worldsWithEvent: 0, totalEvents: 0 },
      blackSwans: { worldsWithEvent: 0, totalEvents: 0 }
    },
    topLevers: ['strategy', 'riskAppetite', 'uncertainty']
  };
}

function deriveTopLevers(config: MonteCarloConfig): LeverKey[] {
  const levers: LeverKey[] = ['strategy', 'riskAppetite'];
  if (config.scenarioParams.uncertainty > 0.5) levers.push('uncertainty');
  if (config.horizonMonths >= 18) levers.push('horizon');
  if (config.scenarioParams.blackSwanEnabled) levers.push('blackSwanShield');
  while (levers.length < 3) levers.push('uncertainty');
  return levers.slice(0, 3);
}


function buildTrajectory(
  scoreRunsByStep: number[][],
  dtDays: number
): TrajectoryPoint[] {
  if (scoreRunsByStep.length === 0) return [];

  return scoreRunsByStep.map((scores, stepIndex) => {
    const sorted = [...scores].sort((a, b) => a - b);
    return {
      dayOffset: (stepIndex + 1) * dtDays,
      p10: percentile(sorted, 0.1),
      p50: percentile(sorted, 0.5),
      p90: percentile(sorted, 0.9)
    };
  });
}

function aggregateResult(
  completedRuns: number,
  horizonMonths: number,
  endingCapitalValues: number[],
  endingResilienceValues: number[],
  endingScoreValues: number[],
  successfulRuns: number,
  stressBreakWorlds: number,
  stressBreakEvents: number,
  drawdownWorlds: number,
  drawdownEvents: number,
  blackSwanWorlds: number,
  blackSwanEvents: number,
  topLevers: LeverKey[],
  scoreRunsByStep: number[][],
  dtDays: number
): SimulationResult {
  const sortedScores = [...endingScoreValues].sort((a, b) => a - b);
  const scorePercentiles: Percentiles = {
    p10: percentile(sortedScores, 0.1),
    p25: percentile(sortedScores, 0.25),
    p50: percentile(sortedScores, 0.5),
    p75: percentile(sortedScores, 0.75),
    p90: percentile(sortedScores, 0.9)
  };

  return {
    runs: completedRuns,
    horizonMonths,
    dtDays,
    endingCapital: buildDistribution(endingCapitalValues),
    endingResilience: buildDistribution(endingResilienceValues),
    endingScore: buildDistribution(endingScoreValues),
    scorePercentiles,
    scoreTrajectory: buildTrajectory(scoreRunsByStep, dtDays),
    endingScoresRaw: [...endingScoreValues],
    successRatio: completedRuns === 0 ? 0 : successfulRuns / completedRuns,
    riskEvents: {
      stressBreaks: { worldsWithEvent: stressBreakWorlds, totalEvents: stressBreakEvents },
      drawdownsOver20: { worldsWithEvent: drawdownWorlds, totalEvents: drawdownEvents },
      blackSwans: { worldsWithEvent: blackSwanWorlds, totalEvents: blackSwanEvents }
    },
    topLevers
  };
}

interface InternalState {
  endingCapitalValues: number[];
  endingResilienceValues: number[];
  endingScoreValues: number[];
  successfulRuns: number;
  stressBreakWorlds: number;
  stressBreakEvents: number;
  drawdownWorlds: number;
  drawdownEvents: number;
  blackSwanWorlds: number;
  blackSwanEvents: number;
  scoreRunsByStep: number[][];
}

function initInternalState(): InternalState {
  return {
    endingCapitalValues: [],
    endingResilienceValues: [],
    endingScoreValues: [],
    successfulRuns: 0,
    stressBreakWorlds: 0,
    stressBreakEvents: 0,
    drawdownWorlds: 0,
    drawdownEvents: 0,
    blackSwanWorlds: 0,
    blackSwanEvents: 0,
    scoreRunsByStep: []
  };
}

function runSingle(config: MonteCarloConfig, state: InternalState, rootRngSeed: number, run: number, steps: number, successThreshold: number): void {
  const rng = createRng(rootRngSeed).fork(run + 1);
  let simState = { ...config.baseState };

  let stressBreakInRun = false;
  let drawdownInRun = false;
  let blackSwanInRun = false;

  for (let stepIndex = 0; stepIndex < steps; stepIndex += 1) {
    if (!state.scoreRunsByStep[stepIndex]) state.scoreRunsByStep[stepIndex] = [];
    const action = config.actionPolicy(simState, stepIndex);
    const outcome = step(simState, action, config.dtDays, config.scenarioParams, rng);
    simState = outcome.state;
    state.scoreRunsByStep[stepIndex].push(scoreState(simState));
    if (outcome.riskFlags.stressBreak) {
      state.stressBreakEvents += 1;
      stressBreakInRun = true;
    }
    if (outcome.riskFlags.drawdownOver20) {
      state.drawdownEvents += 1;
      drawdownInRun = true;
    }
    if (outcome.riskFlags.blackSwan) {
      state.blackSwanEvents += 1;
      blackSwanInRun = true;
    }
  }

  if (stressBreakInRun) state.stressBreakWorlds += 1;
  if (drawdownInRun) state.drawdownWorlds += 1;
  if (blackSwanInRun) state.blackSwanWorlds += 1;

  const endingScore = scoreState(simState);
  state.endingCapitalValues.push(simState.capital);
  state.endingResilienceValues.push(simState.resilience);
  state.endingScoreValues.push(endingScore);
  if (endingScore >= successThreshold) {
    state.successfulRuns += 1;
  }
}

function finalize(config: MonteCarloConfig, completedRuns: number, state: InternalState, topLevers: LeverKey[]): SimulationResult {
  return aggregateResult(
    completedRuns,
    config.horizonMonths,
    state.endingCapitalValues,
    state.endingResilienceValues,
    state.endingScoreValues,
    state.successfulRuns,
    state.stressBreakWorlds,
    state.stressBreakEvents,
    state.drawdownWorlds,
    state.drawdownEvents,
    state.blackSwanWorlds,
    state.blackSwanEvents,
    topLevers,
    state.scoreRunsByStep,
    config.dtDays
  );
}

export function runMonteCarlo(config: MonteCarloConfig): SimulationResult {
  const runs = config.runs ?? DEFAULT_RUNS;
  const progressEvery = config.progressEvery ?? DEFAULT_BATCH;
  const steps = Math.ceil((config.horizonMonths * 30) / config.dtDays);
  const topLevers = deriveTopLevers(config);
  if (runs <= 0 || steps <= 0) return emptyResult(config.horizonMonths, config.dtDays);

  const state = initInternalState();
  const rootSeed = config.scenarioParams.seed;
  const successThreshold = config.successThreshold ?? scoreState(config.baseState);

  for (let run = 0; run < runs; run += 1) {
    if (config.shouldAbort?.()) return finalize(config, run, state, topLevers);
    runSingle(config, state, rootSeed, run, steps, successThreshold);
    const completed = run + 1;
    if (config.onProgress && (completed % progressEvery === 0 || completed === runs)) {
      config.onProgress(completed, finalize(config, completed, state, topLevers));
    }
  }

  return finalize(config, runs, state, topLevers);
}

export async function runMonteCarloAsync(config: MonteCarloConfig): Promise<SimulationResult> {
  const runs = config.runs ?? DEFAULT_RUNS;
  const progressEvery = config.progressEvery ?? DEFAULT_BATCH;
  const steps = Math.ceil((config.horizonMonths * 30) / config.dtDays);
  const topLevers = deriveTopLevers(config);
  if (runs <= 0 || steps <= 0) return emptyResult(config.horizonMonths, config.dtDays);

  const state = initInternalState();
  const rootSeed = config.scenarioParams.seed;
  const successThreshold = config.successThreshold ?? scoreState(config.baseState);

  for (let run = 0; run < runs; run += 1) {
    if (config.shouldAbort?.()) return finalize(config, run, state, topLevers);
    runSingle(config, state, rootSeed, run, steps, successThreshold);
    const completed = run + 1;
    if (completed % progressEvery === 0 || completed === runs) {
      if (config.onProgress) {
        config.onProgress(completed, finalize(config, completed, state, topLevers));
      }
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 0);
      });
    }
  }

  return finalize(config, runs, state, topLevers);
}
