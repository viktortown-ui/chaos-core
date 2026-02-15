/// <reference lib="webworker" />

import { runMonteCarloAsync } from '../../../core/sim/monteCarlo';
import { buildPolicy, buildScenarioParams, SimWorkerRequest, SimWorkerResponse } from './protocol';

interface WorkerPortLike {
  postMessage: (payload: SimWorkerResponse) => void;
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
      const result = await runMonteCarloAsync({
        runs: request.config.runs,
        horizonMonths: request.config.horizonMonths,
        dtDays: request.config.dtDays,
        baseState: request.config.baseState,
        actionPolicy: buildPolicy(request.config.strategy, request.config.riskAppetite, request.config.uncertainty),
        scenarioParams: buildScenarioParams(request.config),
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
