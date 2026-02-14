import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ChaosCoreProvider } from '../../../app/providers/ChaosCoreProvider';
import { CoreScreen } from './CoreScreen';

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
    expect(screen.getByText('Сила')).toBeInTheDocument();
    expect(screen.getByText('Интеллект')).toBeInTheDocument();
    expect(screen.getByText('Мудрость')).toBeInTheDocument();
    expect(screen.getByText('Ловкость')).toBeInTheDocument();
  });

  it('updates xp after daily check-in', async () => {
    renderCore();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Ежедневный чек-ин' }));
    await user.click(screen.getByRole('button', { name: '+1 Сила' }));

    expect(screen.getByText('Опыт: 10')).toBeInTheDocument();
  });
});
