import { describe, expect, it } from 'vitest';
import { DecisionTree, evaluateDecisionTree } from './tree';

describe('decision tree evaluation', () => {
  it('evaluates deterministic branches and finds dominant choice with fixed seed simulation', () => {
    const tree: DecisionTree = {
      rootId: 'root',
      nodes: [
        { id: 'root', type: 'decision', label: 'Choose', constraints: [{ key: 'value', min: 0 }] },
        { id: 'a', type: 'outcome', label: 'A', utility: { value: 5, speed: 2 } },
        { id: 'b', type: 'outcome', label: 'B', utility: { value: 3, speed: 1 } }
      ],
      edges: [
        { from: 'root', to: 'a', label: 'A' },
        { from: 'root', to: 'b', label: 'B' }
      ]
    };

    const result = evaluateDecisionTree(tree, {
      edgeToSimConfig: (edge) => ({
        runs: 120,
        horizonMonths: 6,
        dtDays: 5,
        baseState: { capital: 100, resilience: 35, momentum: 22, stress: 16 },
        actionPolicy: () => ({
          strategy: edge.label === 'A' ? 'balance' : 'defense',
          riskBias: 0.5,
          uncertaintyBias: 0.4
        }),
        scenarioParams: {
          seed: edge.label === 'A' ? 77 : 78,
          uncertainty: 0.4,
          riskAppetite: 0.5,
          blackSwanEnabled: false,
          blackSwanChanceMonthly: 0,
          blackSwanImpact: 1
        }
      })
    });

    expect(result.branches).toHaveLength(2);
    expect(result.branches[0].expectedUtility.value).toBe(5);
    expect(result.branches[1].expectedUtility.value).toBe(3);
    expect(result.dominantBranchIndexes).toEqual([0]);
    expect(result.branches[0].percentiles?.p50).toBeTypeOf('number');
    expect(result.branches[0].collapseRisk).toBeGreaterThanOrEqual(0);
  });
});
