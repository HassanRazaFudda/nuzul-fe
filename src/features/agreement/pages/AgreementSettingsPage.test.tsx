import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { setSession } from '@/mock-api/session';
import { renderApp } from '@/test/render';

import { agreementApi } from '../api/agreement.api';

describe('agreement settings', () => {
  it('a changed payment term shows on the next print', async () => {
    const { user } = renderApp('/settings/agreement');
    const advance = await screen.findByDisplayValue('Advance Payment');

    await user.clear(advance);
    await user.type(advance, 'Initial Payment');
    await user.click(screen.getByRole('button', { name: 'Save agreement text' }));
    expect(await screen.findByText('Agreement settings saved')).toBeInTheDocument();
    cleanup();

    renderApp('/contracts/contract-2/print');
    expect(await screen.findByText('Initial Payment:')).toBeInTheDocument();
  });

  it('adds a terms section, one bullet per line', async () => {
    const { user } = renderApp('/settings/agreement');
    await user.click(await screen.findByRole('button', { name: 'Add section' }));
    const heading = screen.getAllByLabelText(/^Heading/)[3];
    const bullets = screen.getAllByLabelText(/^Bullets/)[3];
    if (!heading || !bullets) throw new Error('expected the new section');
    await user.type(heading, 'Transport');
    await user.type(bullets, 'Bus from Jeddah{Enter}Bus to Madinah');
    await user.click(screen.getByRole('button', { name: 'Save agreement text' }));
    await screen.findByText('Agreement settings saved');

    const saved = await agreementApi.get();
    expect(saved.termsSections.at(-1)).toEqual({
      heading: 'Transport',
      bullets: ['Bus from Jeddah', 'Bus to Madinah'],
    });
  });

  it('is read only without the permission, and the server refuses a save', async () => {
    await setSession('user-sales');
    renderApp('/settings/agreement');

    expect(await screen.findByText('Read only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save agreement text' })).not.toBeInTheDocument();
    await expect(agreementApi.save(await agreementApi.get())).rejects.toThrow(/permission/);
  });
});

describe('the contract print page', () => {
  it('shows every hotel row, the totals, the terms and both signature blocks', async () => {
    renderApp('/contracts/contract-2/print');

    expect(await screen.findByRole('heading', { name: 'HOTEL ACCOMMODATION AGREEMENT' })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Accommodation details and pricing' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(within(table).getByText('10 DBL')).toBeInTheDocument();
    expect(within(table).getByText('30 DBL')).toBeInTheDocument();
    expect(within(table).getByText('26,000/-SR')).toBeInTheDocument();
    expect(within(table).getByText('117,000/-SR')).toBeInTheDocument();
    expect(within(table).getByText('143,000 SAR')).toBeInTheDocument();
    expect(screen.getByText(/No meal plan/)).toBeInTheDocument();
    expect(screen.getByText('Security Deposit:')).toBeInTheDocument();
    expect(screen.getByText('Check-in / Check-out Timings:')).toBeInTheDocument();
    expect(screen.getByText('For & On Behalf of First Party')).toBeInTheDocument();
    expect(screen.getByText('For & On Behalf of Second Party')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText(/SAMPLE AGENT B/)).toHaveLength(2);
    });
  });
});
