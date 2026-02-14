import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { ChaosCoreProvider } from '../providers/ChaosCoreProvider';
import { AppRouter } from './AppRouter';
import { STORAGE_KEY } from '../../core/types';

function renderRouter(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ChaosCoreProvider>
        <AppRouter />
      </ChaosCoreProvider>
    </MemoryRouter>
  );
}

describe('onboarding route gating', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows onboarding when onboarding is not completed', () => {
    renderRouter('/');
    expect(screen.getByText('Choose your Path')).toBeInTheDocument();
  });

  it('does not show onboarding after completion', async () => {
    renderRouter('/');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Warrior' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Strength' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(screen.queryByText('Choose your Path')).not.toBeInTheDocument();
    expect(screen.getByText('Core initialized')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').onboarding.completedAt).toBeTruthy();
  });
});
