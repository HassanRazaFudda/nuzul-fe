import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderApp } from '@/test/render';

describe('CalendarPage', () => {
  it('pre-fills the next month, and accepts any number of days', async () => {
    const { user } = renderApp('/calendar');
    await user.click(await screen.findByRole('button', { name: 'Add month' }));
    expect(screen.getByLabelText(/^First day/)).toHaveValue('2027-07-07');

    await user.type(screen.getByLabelText(/^Month name/), 'Safar');
    const days = screen.getByLabelText(/^Days/);
    await user.clear(days);
    await user.type(days, '25');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Safar')).toBeInTheDocument();
    expect(await screen.findByText('31 Jul 2027')).toBeInTheDocument();
    expect(screen.queryByText('The months do not line up')).not.toBeInTheDocument();
  });

  it('says so when a change leaves a gap', async () => {
    const { user } = renderApp('/calendar');
    await user.click(await screen.findByRole('button', { name: 'Edit Zul-Qadah 1448' }));

    const days = screen.getByLabelText(/^Days/);
    await user.clear(days);
    await user.type(days, '20');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('The months do not line up')).toBeInTheDocument();
    expect(screen.getByText(/^Gap: Zul-Qadah 1448/)).toBeInTheDocument();
  });

  it('refuses a duplicate month number in a year', async () => {
    const { user } = renderApp('/calendar');
    await user.click(await screen.findByRole('button', { name: 'Add month' }));
    await user.type(screen.getByLabelText(/^Month name/), 'Again');

    const number = screen.getByLabelText(/^Month number/);
    await user.clear(number);
    await user.type(number, '1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('This year already has a month with this number')).toBeInTheDocument();
  });
});
