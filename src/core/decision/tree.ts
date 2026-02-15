import { runMonteCarlo } from '../sim/monteCarlo';
import { MonteCarloConfig, Percentiles, SimulationResult } from '../sim/types';

export type UtilityVector = Record<string, number>;

export interface Constraint {
  key: string;
  min?: number;
  max?: number;
}

export interface DecisionNode {
  id: string;
  type: 'decision';
  label: string;
  constraints?: Constraint[];
}

export interface ChanceNode {
  id: string;
  type: 'chance';
  label: string;
}

export interface OutcomeNode {
  id: string;
  type: 'outcome';
  label: string;
  utility: UtilityVector;
  constraints?: Constraint[];
  reasons?: string[];
  nextActions?: string[];
}

export type DecisionTreeNode = DecisionNode | ChanceNode | OutcomeNode;

export interface DecisionTreeEdge {
  from: string;
  to: string;
  label?: string;
  probability?: number;
  utilityAdjustments?: Partial<UtilityVector>;
}

export interface DecisionTree {
  rootId: string;
  nodes: DecisionTreeNode[];
  edges: DecisionTreeEdge[];
}

export interface EvaluatedOutcome {
  nodeId: string;
  label: string;
  probability: number;
  utility: UtilityVector;
  reasons: string[];
  nextActions: string[];
}

export interface BranchEvaluation {
  decisionEdge: DecisionTreeEdge;
  expectedUtility: UtilityVector;
  outcomes: EvaluatedOutcome[];
  constraintsSatisfied: boolean;
  simulation?: SimulationResult;
  percentiles?: Percentiles;
  collapseRisk?: number;
}

export interface DecisionEvaluationResult {
  branches: BranchEvaluation[];
  dominantBranchIndexes: number[];
}

function addUtility(base: UtilityVector, delta: Partial<UtilityVector> | undefined): UtilityVector {
  if (!delta) return { ...base };
  const next: UtilityVector = { ...base };
  Object.entries(delta).forEach(([key, value]) => {
    next[key] = (next[key] ?? 0) + (value ?? 0);
  });
  return next;
}

function multiplyUtility(utility: UtilityVector, factor: number): UtilityVector {
  const next: UtilityVector = {};
  Object.entries(utility).forEach(([key, value]) => {
    next[key] = value * factor;
  });
  return next;
}

function mergeExpected(total: UtilityVector, addend: UtilityVector): UtilityVector {
  const next = { ...total };
  Object.entries(addend).forEach(([key, value]) => {
    next[key] = (next[key] ?? 0) + value;
  });
  return next;
}

function collectOutgoing(edges: DecisionTreeEdge[], from: string): DecisionTreeEdge[] {
  return edges.filter((edge) => edge.from === from);
}

function normalizeChanceEdges(edges: DecisionTreeEdge[]): DecisionTreeEdge[] {
  if (edges.length === 0) return [];
  const explicitSum = edges.reduce((sum, edge) => sum + (edge.probability ?? 0), 0);
  const missing = edges.filter((edge) => edge.probability == null);
  if (missing.length === 0 || explicitSum >= 1) return edges;
  const fill = (1 - explicitSum) / missing.length;
  return edges.map((edge) => (edge.probability == null ? { ...edge, probability: fill } : edge));
}

function checkConstraints(utility: UtilityVector, constraints?: Constraint[]): boolean {
  if (!constraints || constraints.length === 0) return true;
  return constraints.every((constraint) => {
    const value = utility[constraint.key] ?? 0;
    if (constraint.min != null && value < constraint.min) return false;
    if (constraint.max != null && value > constraint.max) return false;
    return true;
  });
}

function evaluateFromNode(
  tree: DecisionTree,
  nodeId: string,
  utilityCarry: UtilityVector,
  probabilityCarry: number
): EvaluatedOutcome[] {
  const node = tree.nodes.find((item) => item.id === nodeId);
  if (!node) return [];

  if (node.type === 'outcome') {
    const totalUtility = addUtility(utilityCarry, node.utility);
    return [{
      nodeId: node.id,
      label: node.label,
      probability: probabilityCarry,
      utility: totalUtility,
      reasons: node.reasons?.slice(0, 2) ?? [],
      nextActions: node.nextActions?.slice(0, 3) ?? []
    }];
  }

  const outgoingRaw = collectOutgoing(tree.edges, node.id);
  const outgoing = node.type === 'chance' ? normalizeChanceEdges(outgoingRaw) : outgoingRaw;

  return outgoing.flatMap((edge) => {
    const branchProbability = node.type === 'chance' ? (edge.probability ?? 0) : 1;
    return evaluateFromNode(
      tree,
      edge.to,
      addUtility(utilityCarry, edge.utilityAdjustments),
      probabilityCarry * branchProbability
    );
  });
}

function evaluateExpected(outcomes: EvaluatedOutcome[]): UtilityVector {
  return outcomes.reduce((acc, outcome) => mergeExpected(acc, multiplyUtility(outcome.utility, outcome.probability)), {});
}

function dominates(left: UtilityVector, right: UtilityVector): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let strictlyBetter = false;
  for (const key of keys) {
    const l = left[key] ?? 0;
    const r = right[key] ?? 0;
    if (l < r) return false;
    if (l > r) strictlyBetter = true;
  }
  return strictlyBetter;
}

export interface BranchSimulationInput {
  edgeToSimConfig: (edge: DecisionTreeEdge) => MonteCarloConfig;
}

export function computeCollapseRisk(result: SimulationResult): number {
  const runSafe = Math.max(1, result.runs);
  const stressRate = result.riskEvents.stressBreaks / runSafe;
  const drawdownRate = result.riskEvents.drawdownsOver20 / runSafe;
  const blackSwanRate = result.riskEvents.blackSwans / runSafe;
  const resiliencePenalty = Math.max(0, 1 - result.endingResilience.mean / 100);

  return Math.min(1, stressRate * 0.35 + drawdownRate * 0.35 + blackSwanRate * 0.2 + resiliencePenalty * 0.1);
}

export function evaluateDecisionTree(tree: DecisionTree, simulation?: BranchSimulationInput): DecisionEvaluationResult {
  const root = tree.nodes.find((node) => node.id === tree.rootId);
  if (!root || root.type !== 'decision') {
    return { branches: [], dominantBranchIndexes: [] };
  }

  const decisionEdges = collectOutgoing(tree.edges, root.id).slice(0, 3);
  const branches = decisionEdges.map((edge) => {
    const outcomes = evaluateFromNode(tree, edge.to, addUtility({}, edge.utilityAdjustments), 1);
    const expectedUtility = evaluateExpected(outcomes);
    const constraintsSatisfied = checkConstraints(expectedUtility, root.constraints);
    const branchConstraintsSatisfied = outcomes.every((outcome) => {
      const outcomeNode = tree.nodes.find((node) => node.id === outcome.nodeId);
      return outcomeNode?.type === 'outcome' ? checkConstraints(outcome.utility, outcomeNode.constraints) : true;
    });

    let simulationResult: SimulationResult | undefined;
    let collapseRisk: number | undefined;
    if (simulation) {
      simulationResult = runMonteCarlo(simulation.edgeToSimConfig(edge));
      collapseRisk = computeCollapseRisk(simulationResult);
    }

    return {
      decisionEdge: edge,
      expectedUtility,
      outcomes,
      constraintsSatisfied: constraintsSatisfied && branchConstraintsSatisfied,
      simulation: simulationResult,
      percentiles: simulationResult?.scorePercentiles,
      collapseRisk
    } satisfies BranchEvaluation;
  });

  const dominantBranchIndexes = branches
    .map((branch, index) => ({ branch, index }))
    .filter(({ branch, index }) =>
      branches.every((candidate, candidateIndex) =>
        candidateIndex === index || dominates(branch.expectedUtility, candidate.expectedUtility)
      )
    )
    .map((item) => item.index);

  return { branches, dominantBranchIndexes };
}
