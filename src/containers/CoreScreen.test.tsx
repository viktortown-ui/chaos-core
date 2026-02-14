import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CoreScreen } from './CoreScreen';
import { ChaosCoreProvider } from './state';

function renderCore() {
  return render(
    <MemoryRouter>
      <ChaosCoreProvider>
        <CoreScreen />
      </ChaosCoreProvider>
    </MemoryRouter>
  );
}

describe('CoreScreen', () => {
  it('renders primary stats', () => {
    renderCore();
    expect(screen.getByText('Strength')).toBeInTheDocument();
    expect(screen.getByText('Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Wisdom')).toBeInTheDocument();
    expect(screen.getByText('Dexterity')).toBeInTheDocument();
  });

  it('updates xp after daily check-in', async () => {
    renderCore();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Daily Check-in' }));
    await user.click(screen.getByRole('button', { name: '+1 Strength' }));

    expect(screen.getByText('XP: 10')).toBeInTheDocument();
  });
});
