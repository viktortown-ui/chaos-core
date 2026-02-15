import { describe, expect, it } from 'vitest';
import { createDecisionWorkerHandler } from './decision.worker';
import { DecisionWorkerConfig, DecisionWorkerResponse } from './protocol';

const baseConfig: DecisionWorkerConfig = {
  runs: 120,
  horizonMonths: 6,
  dtDays: 5,
  seed: 11,
  baseState: { capital: 100, resilience: 30, momentum: 20, stress: 20 },
  branches: [
    { id: 'A', label: 'A', strategy: 'attack', riskAppetite: 0.8, uncertainty: 0.6, blackSwanEnabled: false, reasons: ['r1'], nextActions: ['n1'] },
    { id: 'B', label: 'B', strategy: 'balance', riskAppetite: 0.5, uncertainty: 0.4, blackSwanEnabled: true, reasons: ['r2'], nextActions: ['n2'] },
    { id: 'C', label: 'C', strategy: 'defense', riskAppetite: 0.3, uncertainty: 0.2, blackSwanEnabled: true, reasons: ['r3'], nextActions: ['n3'] }
  ]
};

async function runWithId(id: string) {
  const messages: DecisionWorkerResponse[] = [];
  const handler = createDecisionWorkerHandler({ postMessage: (payload) => messages.push(payload) });
  await handler({ type: 'start', id, config: baseConfig });
  return messages.find((item) => item.type === 'done');
}

describe('decision worker', () => {
  it('returns up to three compared branches', async () => {
    const done = await runWithId('d-1');
    expect(done).toBeTruthy();
    if (done?.type === 'done') {
      expect(done.branches).toHaveLength(3);
      expect(done.branches[0].percentiles.p10).toBeTypeOf('number');
    }
  });

  it('is deterministic for a fixed seed and config', async () => {
    const first = await runWithId('stable-1');
    const second = await runWithId('stable-2');

    expect(first?.type).toBe('done');
    expect(second?.type).toBe('done');

    if (first?.type === 'done' && second?.type === 'done') {
      expect(second.branches).toEqual(first.branches);
    }
  });
});
