import { Action, ScenarioParams, StateVector, StrategyMode } from '../../../core/sim/types';

export interface DecisionBranchPayload {
  id: string;
  label: string;
  strategy: StrategyMode;
  riskAppetite: number;
  uncertainty: number;
  blackSwanEnabled: boolean;
  reasons: string[];
  nextActions: string[];
}

export interface DecisionWorkerConfig {
  runs: number;
  horizonMonths: number;
  dtDays: number;
  seed: number;
  baseState: StateVector;
  branches: DecisionBranchPayload[];
}

export type DecisionWorkerRequest =
  | { type: 'start'; id: string; config: DecisionWorkerConfig }
  | { type: 'cancel'; id: string };

export interface DecisionBranchResultPayload {
  id: string;
  label: string;
  expectedUtility: Record<string, number>;
  percentiles: { p10: number; p50: number; p90: number };
  collapseRisk: number;
  reasons: string[];
  nextActions: string[];
  constraintsSatisfied: boolean;
  dominant: boolean;
}

export type DecisionWorkerResponse =
  | { type: 'done'; id: string; branches: DecisionBranchResultPayload[] }
  | { type: 'cancelled'; id: string }
  | { type: 'error'; id: string; message: string };

export function buildScenarioParams(seed: number, branch: DecisionBranchPayload): ScenarioParams {
  return {
    seed,
    uncertainty: branch.uncertainty,
    riskAppetite: branch.riskAppetite,
    blackSwanEnabled: branch.blackSwanEnabled,
    blackSwanChanceMonthly: branch.blackSwanEnabled ? 0.02 + branch.uncertainty * 0.04 : 0,
    blackSwanImpact: 1.4 - branch.riskAppetite * 0.5
  };
}

export function buildPolicy(branch: DecisionBranchPayload): (state: StateVector, stepIndex: number) => Action {
  return () => ({
    strategy: branch.strategy,
    riskBias: branch.riskAppetite,
    uncertaintyBias: branch.uncertainty
  });
}
