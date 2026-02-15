import { describe, expect, it } from 'vitest';
import { createDecisionWorkerHandler } from './decision.worker';
import { DecisionWorkerResponse } from './protocol';

describe('decision worker', () => {
  it('returns up to three compared branches', async () => {
    const messages: DecisionWorkerResponse[] = [];
    const handler = createDecisionWorkerHandler({ postMessage: (payload) => messages.push(payload) });

    await handler({
      type: 'start',
      id: 'd-1',
      config: {
        runs: 100,
        horizonMonths: 6,
        dtDays: 5,
        seed: 11,
        baseState: { capital: 100, resilience: 30, momentum: 20, stress: 20 },
        branches: [
          { id: 'A', label: 'A', strategy: 'attack', riskAppetite: 0.8, uncertainty: 0.6, blackSwanEnabled: false, reasons: ['r1'], nextActions: ['n1'] },
          { id: 'B', label: 'B', strategy: 'balance', riskAppetite: 0.5, uncertainty: 0.4, blackSwanEnabled: true, reasons: ['r2'], nextActions: ['n2'] },
          { id: 'C', label: 'C', strategy: 'defense', riskAppetite: 0.3, uncertainty: 0.2, blackSwanEnabled: true, reasons: ['r3'], nextActions: ['n3'] }
        ]
      }
    });

    const done = messages.find((item) => item.type === 'done');
    expect(done).toBeTruthy();
    if (done?.type === 'done') {
      expect(done.branches).toHaveLength(3);
      expect(done.branches[0].percentiles.p10).toBeTypeOf('number');
    }
  });
});
