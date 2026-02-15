import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from '../../../app/router/AppRouter';
import { ChaosCoreProvider } from '../../../app/providers/ChaosCoreProvider';
import { STORAGE_KEY } from '../../../core/types';
import { buildDemoData } from '../../../core/storage';

class WorkerMock {
  onmessage: ((event: MessageEvent) => void) | null = null;

  postMessage(message: { type: string; id: string; config?: { branches: Array<{ id: string; label: string }> } }) {
    if (message.type !== 'start' || !this.onmessage) return;
    const branches = (message.config?.branches ?? []).map((branch, index) => ({
      id: branch.id,
      label: branch.label,
      expectedUtility: { expectedScore: index + 1 },
      percentiles: { p10: 1, p50: 2, p90: 3 },
      collapseRisk: 0.4,
      reasons: ['because'],
      nextActions: ['next'],
      constraintsSatisfied: true,
      dominant: index === 0
    }));

    this.onmessage({ data: { type: 'done', id: message.id, branches } } as MessageEvent);
  }

  terminate() {
    return undefined;
  }
}

function renderOracle() {
  return render(
    <MemoryRouter initialEntries={['/oracle']}>
      <ChaosCoreProvider>
        <AppRouter />
      </ChaosCoreProvider>
    </MemoryRouter>
  );
}

describe('DecisionScreen', () => {
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

  it('mounts oracle screen with i18n labels and reduced-motion class', async () => {
    renderOracle();

    expect(screen.getByRole('heading', { name: 'Оракул / Решение' })).toBeInTheDocument();
    expect(screen.getByText('Ветка A — Атака')).toBeInTheDocument();
    expect(screen.getByText('Ветка B — Баланс')).toBeInTheDocument();
    expect(screen.getByText('Ветка C — Защита')).toBeInTheDocument();

    const section = document.querySelector('.decision-screen');
    expect(section).toHaveClass('reduce-motion');

    await waitFor(() => {
      expect(screen.getAllByText(/Риск: 4 \/ 10/)).toHaveLength(3);
    });
  });
});
