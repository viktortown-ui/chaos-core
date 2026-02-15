import { describe, expect, it } from 'vitest';
import { createSimWorkerHandler } from './sim.worker';
import { SimWorkerResponse } from './protocol';

describe('sim worker protocol', () => {
  it('emits progress and done for start', async () => {
    const messages: SimWorkerResponse[] = [];
    const handler = createSimWorkerHandler({ postMessage: (payload) => messages.push(payload) });

    await handler({
      type: 'start',
      id: 'job-1',
      config: {
        runs: 300,
        horizonMonths: 6,
        dtDays: 5,
        seed: 7,
        baseState: { capital: 100, resilience: 30, momentum: 20, stress: 20 },
        strategy: 'balance',
        uncertainty: 0.5,
        riskAppetite: 0.5,
        blackSwanEnabled: false,
        successThreshold: 120
      }
    });

    expect(messages.some((message) => message.type === 'progress')).toBe(true);
    const done = messages.find((message) => message.type === 'done');
    expect(done).toBeTruthy();
    if (done?.type === 'done') expect(done.result.runs).toBe(300);
  });

  it('supports cancellation', async () => {
    const messages: SimWorkerResponse[] = [];
    const handler = createSimWorkerHandler({ postMessage: (payload) => messages.push(payload) });

    const startPromise = handler({
      type: 'start',
      id: 'job-2',
      config: {
        runs: 10_000,
        horizonMonths: 24,
        dtDays: 5,
        seed: 7,
        baseState: { capital: 100, resilience: 30, momentum: 20, stress: 20 },
        strategy: 'attack',
        uncertainty: 1,
        riskAppetite: 1,
        blackSwanEnabled: true,
        successThreshold: 120
      }
    });

    await handler({ type: 'cancel', id: 'job-2' });
    await startPromise;

    expect(messages.some((message) => message.type === 'cancelled' && message.id === 'job-2')).toBe(true);
  });

  it('returns sensitivity suggestions', async () => {
    const messages: SimWorkerResponse[] = [];
    const handler = createSimWorkerHandler({ postMessage: (payload) => messages.push(payload) });

    await handler({
      type: 'sensitivity',
      id: 'job-3',
      config: {
        runs: 1000,
        horizonMonths: 12,
        dtDays: 5,
        seed: 7,
        baseState: { capital: 100, resilience: 30, momentum: 20, stress: 20 },
        strategy: 'balance',
        uncertainty: 0.5,
        riskAppetite: 0.5,
        blackSwanEnabled: true,
        successThreshold: 120
      }
    });

    const done = messages.find((message) => message.type === 'sensitivity-done');
    expect(done).toBeTruthy();
    if (done?.type === 'sensitivity-done') expect(done.levers).toHaveLength(3);
  });
});
