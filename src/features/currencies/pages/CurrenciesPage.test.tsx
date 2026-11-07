import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockDb } from '@/mock-api/db';
import { renderApp } from '@/test/render';

import { currencySchema, exchangeRateSchema } from '../api/currency.schemas';

describe('CurrenciesPage', () => {
  it('adds a new rate without overwriting the old one', async () => {
    const { user } = renderApp('/currencies');
    await user.click(await screen.findByRole('button', { name: 'Update SAR rate' }));

    await user.type(screen.getByLabelText(/^New rate/), '72.5');
    await user.click(screen.getByRole('button', { name: 'Add rate' }));

    expect(await screen.findByText('72.5')).toBeInTheDocument();
    const rates = await mockDb.list('exchangeRates', exchangeRateSchema);
    const sar = rates.filter((rate) => rate.currencyCode === 'SAR').map((rate) => rate.rateToPkr);
    expect(sar.sort()).toEqual(['70', '72.5']);
  });

  it('adds a currency only with a rate, and uppercases its code', async () => {
    const { user } = renderApp('/currencies');
    await user.click(await screen.findByRole('button', { name: 'Add currency' }));
    await user.type(screen.getByLabelText(/^Code/), 'aed');
    await user.type(screen.getByLabelText(/^Symbol/), 'AED');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('A new currency needs a rate')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Rate against PKR/), '76');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      expect((await mockDb.get('currencies', 'AED', currencySchema))?.code).toBe('AED');
    });
    const rates = await mockDb.list('exchangeRates', exchangeRateSchema);
    expect(rates.some((rate) => rate.currencyCode === 'AED')).toBe(true);
  });

  it('never offers to disable PKR or SAR, or to change the PKR rate', async () => {
    renderApp('/currencies');

    await screen.findByRole('button', { name: 'Disable USD' });

    expect(screen.queryByRole('button', { name: 'Disable PKR' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Disable SAR' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update PKR rate' })).not.toBeInTheDocument();
  });

  it('refuses a rate of zero', async () => {
    const { user } = renderApp('/currencies');
    await user.click(await screen.findByRole('button', { name: 'Update USD rate' }));

    await user.type(screen.getByLabelText(/^New rate/), '0');
    await user.click(screen.getByRole('button', { name: 'Add rate' }));

    expect(await screen.findByText('The rate must be above zero')).toBeInTheDocument();
  });
});
