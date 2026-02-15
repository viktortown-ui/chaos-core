import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ChaosCoreProvider } from '../../../app/providers/ChaosCoreProvider';
import { buildDemoData } from '../../../core/storage';
import { HistoryScreen } from './HistoryScreen';

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;

  postMessage(payload: { type: string; id: string }) {
    if (payload.type !== 'start') return;
    this.onmessage?.({
      data: {
        type: 'done',
        id: payload.id,
        result: {
          runs: 100,
          horizonMonths: 12,
          dtDays: 5,
          endingCapital: { binEdges: [0, 1], bins: [1], min: 0, max: 1, mean: 0.5 },
          endingResilience: { binEdges: [0, 1], bins: [1], min: 0, max: 1, mean: 0.5 },
          endingScore: { binEdges: [10, 20, 30], bins: [3, 2], min: 10, max: 30, mean: 18 },
          scorePercentiles: { p10: 12, p25: 15, p50: 18, p75: 21, p90: 24 },
          scoreTrajectory: [
            { dayOffset: 30, p10: 12, p50: 16, p90: 21 },
            { dayOffset: 60, p10: 13, p50: 18, p90: 24 }
          ],
          successRatio: 0.52,
          riskEvents: { stressBreaks: 1, drawdownsOver20: 1, blackSwans: 0 },
          topLevers: ['strategy', 'riskAppetite', 'uncertainty']
        }
      }
    } as MessageEvent);
  }

  terminate() {
    return undefined;
  }
}

describe('HistoryScreen charts smoke', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', MockWorker);
    localStorage.clear();
  });

  it('mounts charts with i18n labels and reduced-motion transition disabled', async () => {
    const seed = buildDemoData(new Date('2026-02-14T09:00:00.000Z'));
    seed.settings.language = 'ru';
    seed.settings.reduceMotionOverride = true;
    localStorage.setItem('chaos-core:v1', JSON.stringify(seed));

    render(
      <MemoryRouter>
        <ChaosCoreProvider>
          <HistoryScreen />
        </ChaosCoreProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('img', { name: 'Ключевые метрики во времени' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Прогнозные диапазоны (p10 / p50 / p90)' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Распределение прогноза' })).toBeInTheDocument();
    });

    const panel = document.querySelector('.history-forecast-panel') as HTMLElement;
    expect(panel.style.transition).toBe('none');
  });
});
