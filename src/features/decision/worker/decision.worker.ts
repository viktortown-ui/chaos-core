/// <reference lib="webworker" />

import {
  DecisionTree,
  evaluateDecisionTree
} from '../../../core/decision/tree';
import { DecisionWorkerRequest, DecisionWorkerResponse, buildPolicy, buildScenarioParams } from './protocol';

interface WorkerPortLike {
  postMessage: (payload: DecisionWorkerResponse) => void;
}

function buildTree(config: DecisionWorkerRequest & { type: 'start' }): DecisionTree {
  const rootId = 'root-decision';
  const nodes: DecisionTree['nodes'] = [
    {
      id: rootId,
      type: 'decision',
      label: 'Decision root',
      constraints: [
        { key: 'expectedScore', min: -50 },
        { key: 'collapseRisk', max: 0.6 }
      ]
    }
  ];

  const edges: DecisionTree['edges'] = [];

  config.config.branches.slice(0, 3).forEach((branch) => {
    const chanceId = `chance-${branch.id}`;
    const upOutcomeId = `outcome-up-${branch.id}`;
    const downOutcomeId = `outcome-down-${branch.id}`;

    nodes.push({ id: chanceId, type: 'chance', label: branch.label });
    nodes.push({
      id: upOutcomeId,
      type: 'outcome',
      label: `${branch.label} / up`,
      utility: { narrativeScore: 14, expectedScore: 8 },
      reasons: branch.reasons,
      nextActions: branch.nextActions
    });
    nodes.push({
      id: downOutcomeId,
      type: 'outcome',
      label: `${branch.label} / down`,
      utility: { narrativeScore: -6, expectedScore: -10 },
      reasons: branch.reasons,
      nextActions: branch.nextActions
    });

    edges.push({
      from: rootId,
      to: chanceId,
      label: branch.label,
      utilityAdjustments: {
        resilience: (1 - branch.uncertainty) * 8,
        optionality: (1 - branch.riskAppetite) * 6
      }
    });
    edges.push({ from: chanceId, to: upOutcomeId, probability: 0.62 - branch.uncertainty * 0.2 });
    edges.push({ from: chanceId, to: downOutcomeId, probability: 0.38 + branch.uncertainty * 0.2 });
  });

  return {
    rootId,
    nodes,
    edges
  };
}

export function createDecisionWorkerHandler(port: WorkerPortLike) {
  const cancelledIds = new Set<string>();

  return async (request: DecisionWorkerRequest) => {
    if (request.type === 'cancel') {
      cancelledIds.add(request.id);
      port.postMessage({ type: 'cancelled', id: request.id });
      return;
    }

    cancelledIds.delete(request.id);

    try {
      const tree = buildTree(request);
      const branchConfig = new Map(request.config.branches.map((branch) => [branch.label, branch]));
      const evaluation = evaluateDecisionTree(tree, {
        edgeToSimConfig: (edge) => {
          const branch = branchConfig.get(edge.label ?? '');
          if (!branch) throw new Error('Unknown branch while mapping decision tree to simulation');
          return {
            runs: request.config.runs,
            horizonMonths: request.config.horizonMonths,
            dtDays: request.config.dtDays,
            baseState: request.config.baseState,
            actionPolicy: buildPolicy(branch),
            scenarioParams: buildScenarioParams(request.config.seed + edge.to.length, branch)
          };
        }
      });

      if (cancelledIds.has(request.id)) {
        port.postMessage({ type: 'cancelled', id: request.id });
        return;
      }

      const branches = evaluation.branches.map((branch, index) => {
        const p = branch.percentiles ?? { p10: 0, p50: 0, p90: 0, p25: 0, p75: 0 };
        const reasons = branch.outcomes.find((outcome) => outcome.reasons.length > 0)?.reasons ?? [];
        const nextActions = branch.outcomes.find((outcome) => outcome.nextActions.length > 0)?.nextActions ?? [];
        return {
          id: request.config.branches[index]?.id ?? `branch-${index}`,
          label: branch.decisionEdge.label ?? `Branch ${index + 1}`,
          expectedUtility: branch.expectedUtility,
          percentiles: { p10: p.p10, p50: p.p50, p90: p.p90 },
          collapseRisk: branch.collapseRisk ?? 0,
          reasons,
          nextActions,
          constraintsSatisfied: branch.constraintsSatisfied,
          dominant: evaluation.dominantBranchIndexes.includes(index)
        };
      });

      port.postMessage({ type: 'done', id: request.id, branches });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown worker error';
      port.postMessage({ type: 'error', id: request.id, message });
    }
  };
}

const handler = createDecisionWorkerHandler(self as unknown as WorkerPortLike);

self.onmessage = (event: MessageEvent<DecisionWorkerRequest>) => {
  void handler(event.data);
};
