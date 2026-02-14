import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChaosCoreProvider } from '../../../app/providers/ChaosCoreProvider';
import { SettingsScreen } from './SettingsScreen';

describe('SettingsScreen demo data', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads deterministic demo data values', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-14T09:00:00.000Z'));

    render(
      <MemoryRouter>
        <ChaosCoreProvider>
          <SettingsScreen />
        </ChaosCoreProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Загрузить демо-данные' }));

    const saved = JSON.parse(localStorage.getItem('chaos-core:v1') ?? '{}');
    expect(saved.xp).toBe(120);
    expect(saved.stats).toEqual({
      strength: 8,
      intelligence: 4,
      wisdom: 3,
      dexterity: 5
    });
    expect(saved.lastCheckInISO).toBe('2026-02-13T09:00:00.000Z');

    vi.useRealTimers();
  });
});
