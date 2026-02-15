/// <reference lib="webworker" />

import { runMonteCarloAsync } from '../../../core/sim/monteCarlo';
import { buildPolicy, buildScenarioParams, SensitivityItem, SimConfigPayload, SimWorkerRequest, SimWorkerResponse } from './protocol';

interface WorkerPortLike {
  postMessage: (payload: SimWorkerResponse) => void;
}

function pct(part: number, total: number): number {
  return total <= 0 ? 0 : part / total;
}

async function runOnce(config: SimConfigPayload, runs: number) {
  return runMonteCarloAsync({
    runs,
    horizonMonths: config.horizonMonths,
    dtDays: config.dtDays,
    baseState: config.baseState,
    actionPolicy: buildPolicy(config.strategy, config.riskAppetite, config.uncertainty),
    scenarioParams: buildScenarioParams(config),
    successThreshold: config.successThreshold
  });
}

async function evaluateSensitivity(config: SimConfigPayload): Promise<SensitivityItem[]> {
  const base = await runOnce(config, 1200);
  const candidates: Array<{ lever: SensitivityItem['lever']; labelKey: string; cost: number; next: SimConfigPayload }> = [
    { lever: 'strategy', labelKey: 'leverStrategy', cost: 0.6, next: { ...config, strategy: config.strategy === 'attack' ? 'balance' : 'defense' } },
    { lever: 'riskAppetite', labelKey: 'leverRiskAppetite', cost: 0.4, next: { ...config, riskAppetite: Math.max(0.1, config.riskAppetite - 0.12) } },
    { lever: 'horizon', labelKey: 'leverHorizon', cost: 0.35, next: { ...config, horizonMonths: Math.max(6, config.horizonMonths - 6) } },
    { lever: 'blackSwanShield', labelKey: 'leverBlackSwanShield', cost: 0.5, next: { ...config, blackSwanEnabled: true } },
    { lever: 'uncertainty', labelKey: 'leverUncertainty', cost: 0.7, next: { ...config, uncertainty: Math.max(0.1, config.uncertainty - 0.1) } },
    { lever: 'riskAppetite', labelKey: 'leverLowerThreshold', cost: 0.2, next: { ...config, successThreshold: Math.max(10, config.successThreshold - 8) } }
  ];

  const scored: SensitivityItem[] = [];
  for (const candidate of candidates) {
    const result = await runOnce(candidate.next, 1200);
    const successDelta = Math.round((result.successRatio - base.successRatio) * 10);
    const drawdownBase = pct(base.riskEvents.drawdownsOver20, Math.max(1, base.runs));
    const drawdownNext = pct(result.riskEvents.drawdownsOver20, Math.max(1, result.runs));
    const drawdownDelta = Math.round((drawdownNext - drawdownBase) * 100);
    const score = successDelta * 2 - drawdownDelta - candidate.cost;
    scored.push({
      lever: candidate.lever,
      labelKey: candidate.labelKey,
      successDelta,
      drawdownDelta,
      cost: candidate.cost,
      score,
      nextConfig: {
        strategy: candidate.next.strategy,
        riskAppetite: candidate.next.riskAppetite,
        horizonMonths: candidate.next.horizonMonths,
        successThreshold: candidate.next.successThreshold
      }
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}

export function createSimWorkerHandler(port: WorkerPortLike) {
  const cancelledIds = new Set<string>();

  return async (request: SimWorkerRequest) => {
    if (request.type === 'cancel') {
      cancelledIds.add(request.id);
      port.postMessage({ type: 'cancelled', id: request.id });
      return;
    }

    cancelledIds.delete(request.id);

    try {
      if (request.type === 'sensitivity') {
        const levers = await evaluateSensitivity(request.config);
        if (!cancelledIds.has(request.id)) {
          port.postMessage({ type: 'sensitivity-done', id: request.id, levers });
        }
        return;
      }

      const result = await runMonteCarloAsync({
        runs: request.config.runs,
        horizonMonths: request.config.horizonMonths,
        dtDays: request.config.dtDays,
        baseState: request.config.baseState,
        actionPolicy: buildPolicy(request.config.strategy, request.config.riskAppetite, request.config.uncertainty),
        scenarioParams: buildScenarioParams(request.config),
        successThreshold: request.config.successThreshold,
        progressEvery: 250,
        shouldAbort: () => cancelledIds.has(request.id),
        onProgress: (completedRuns, partialResult) => {
          port.postMessage({
            type: 'progress',
            id: request.id,
            progress: completedRuns / request.config.runs,
            partialResult
          });
        }
      });

      if (cancelledIds.has(request.id)) {
        port.postMessage({ type: 'cancelled', id: request.id });
        return;
      }

      port.postMessage({ type: 'done', id: request.id, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown worker error';
      port.postMessage({ type: 'error', id: request.id, message });
    }
  };
}

const handler = createSimWorkerHandler(self as unknown as WorkerPortLike);

self.onmessage = (event: MessageEvent<SimWorkerRequest>) => {
  void handler(event.data);
};
