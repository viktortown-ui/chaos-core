import { Action, ScenarioParams, SimulationResult, StateVector, StrategyMode } from '../../../core/sim/types';

export interface SimConfigPayload {
  runs: number;
  horizonMonths: number;
  dtDays: number;
  seed: number;
  baseState: StateVector;
  strategy: StrategyMode;
  uncertainty: number;
  riskAppetite: number;
  blackSwanEnabled: boolean;
}

export type SimWorkerRequest =
  | { type: 'start'; id: string; config: SimConfigPayload }
  | { type: 'cancel'; id: string };

export type SimWorkerResponse =
  | { type: 'progress'; id: string; progress: number; partialResult: SimulationResult }
  | { type: 'done'; id: string; result: SimulationResult }
  | { type: 'cancelled'; id: string }
  | { type: 'error'; id: string; message: string };

export function buildScenarioParams(config: SimConfigPayload): ScenarioParams {
  return {
    seed: config.seed,
    uncertainty: config.uncertainty,
    riskAppetite: config.riskAppetite,
    blackSwanEnabled: config.blackSwanEnabled,
    blackSwanChanceMonthly: config.blackSwanEnabled ? 0.02 + config.uncertainty * 0.04 : 0,
    blackSwanImpact: 1.4 - config.riskAppetite * 0.5
  };
}

export function buildPolicy(strategy: StrategyMode, riskAppetite: number, uncertainty: number): (state: StateVector, stepIndex: number) => Action {
  return () => ({
    strategy,
    riskBias: riskAppetite,
    uncertaintyBias: uncertainty
  });
}
