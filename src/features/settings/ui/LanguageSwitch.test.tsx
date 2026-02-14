import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ChaosCoreProvider } from '../../../app/providers/ChaosCoreProvider';
import { Layout } from '../../../app/layout/Layout';
import { SettingsScreen } from './SettingsScreen';

describe('language switch', () => {
  it('uses Russian by default and switches to English', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ChaosCoreProvider>
          <Layout />
          <SettingsScreen />
        </ChaosCoreProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Ядро Хаоса')).toBeInTheDocument();
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'en');

    expect(screen.getByText('Chaos Core')).toBeInTheDocument();
  });
});
