import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from '../../../app/router/AppRouter';
import { ChaosCoreProvider } from '../../../app/providers/ChaosCoreProvider';
import { STORAGE_KEY } from '../../../core/types';
import { buildDemoData } from '../../../core/storage';

vi.mock('../../charts/UPlotChart', () => ({
  UPlotChart: ({ onTogglePin, onScrubIndex }: { onTogglePin?: (idx: number) => void; onScrubIndex?: (idx: number) => void }) => (
    <div
      data-testid="chart-overlay"
      onClick={() => {
        onScrubIndex?.(1);
        onTogglePin?.(1);
      }}
    />
  )
}));

class WorkerMock {
  onmessage: ((event: MessageEvent) => void) | null = null;

  postMessage(message: { type: string; id: string }) {
    if (!this.onmessage) return;
    if (message.type === 'start') {
      const result = {
        runs: 10000,
        horizonMonths: 12,
        dtDays: 5,
        endingCapital: { binEdges: [0], bins: [1], min: 0, max: 1, mean: 0.5 },
        endingResilience: { binEdges: [0], bins: [1], min: 0, max: 1, mean: 0.5 },
        endingScore: { binEdges: [100, 140], bins: [200, 800], min: 100, max: 140, mean: 120 },
        scorePercentiles: { p10: 100, p25: 110, p50: 120, p75: 130, p90: 138 },
        scoreTrajectory: [
          { dayOffset: 30, p10: 95, p50: 108, p90: 122 },
          { dayOffset: 60, p10: 98, p50: 118, p90: 136 }
        ],
        endingScoresRaw: [100, 120],
        successRatio: 0.7,
        riskEvents: {
          stressBreaks: { worldsWithEvent: 1200, totalEvents: 2800 },
          drawdownsOver20: { worldsWithEvent: 800, totalEvents: 4900 },
          blackSwans: { worldsWithEvent: 340, totalEvents: 460 }
        },
        topLevers: ['strategy', 'riskAppetite', 'uncertainty']
      };
      this.onmessage({ data: { type: 'done', id: message.id, result } } as MessageEvent);
    }
    if (message.type === 'sensitivity') {
      this.onmessage({ data: { type: 'sensitivity-done', id: message.id, levers: [
        { lever: 'strategy', labelKey: 'leverStrategy', successDelta: 2, drawdownDelta: -5, cost: 0.5, score: 4, nextConfig: { strategy: 'attack', horizonMonths: 20, successThreshold: 111 } },
        { lever: 'riskAppetite', labelKey: 'leverRiskAppetite', successDelta: 1, drawdownDelta: -2, cost: 0.4, score: 2, nextConfig: {} },
        { lever: 'horizon', labelKey: 'leverHorizon', successDelta: 1, drawdownDelta: -1, cost: 0.3, score: 1, nextConfig: {} }
      ] } } as MessageEvent);
    }
  }

  terminate() {
    return undefined;
  }
}

function renderSimulation() {
  return render(
    <MemoryRouter initialEntries={['/simulation']}>
      <ChaosCoreProvider>
        <AppRouter />
      </ChaosCoreProvider>
    </MemoryRouter>
  );
}

describe('SimulationScreen', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    localStorage.clear();
    const demo = buildDemoData();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...demo,
        settings: {
          ...demo.settings,
          reduceMotionOverride: true,
          language: 'ru'
        }
      })
    );
    vi.stubGlobal('Worker', WorkerMock);
  });

  it('renders hero card with RU labels', async () => {
    renderSimulation();
    fireEvent.click(screen.getByRole('button', { name: 'Запустить симуляцию' }));

    await waitFor(() => {
      expect(screen.getByText('Панель управления')).toBeInTheDocument();
      expect(screen.getByText('Успех')).toBeInTheDocument();
      expect(screen.getByText(/Запас к порогу/)).toBeInTheDocument();
    });
  });

  it('applies best lever deterministically', async () => {
    renderSimulation();
    fireEvent.click(screen.getByRole('button', { name: 'Запустить симуляцию' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Применить лучший рычаг' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Применить лучший рычаг' }));
    expect(screen.getByText(/Горизонт \(месяцы\)/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('111')).toBeInTheDocument();
  });

  it('pins and unpins on chart tap without pin buttons', async () => {
    renderSimulation();
    fireEvent.click(screen.getByRole('button', { name: 'Запустить симуляцию' }));

    await waitFor(() => {
      expect(screen.getByTestId('chart-overlay')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Закрепить точку' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('chart-overlay'));
    expect(screen.getByText('Закреплено: Месяц 2')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('chart-overlay'));
    expect(screen.queryByText('Закреплено: Месяц 2')).not.toBeInTheDocument();
  });

  it('does not animate hero pulse in reduced-motion', async () => {
    renderSimulation();
    fireEvent.click(screen.getByRole('button', { name: 'Запустить симуляцию' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Применить лучший рычаг' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Применить лучший рычаг' }));
    expect(document.querySelector('.sim-screen')).toHaveClass('reduce-motion');
    expect(document.querySelector('.sim-hero')).not.toHaveClass('sim-hero-pulse');
  });
});
