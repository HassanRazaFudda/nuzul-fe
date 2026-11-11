import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { purchaseSchema } from '@/features/purchases';
import { mockDb } from '@/mock-api/db';
import { renderApp } from '@/test/render';

import { toSheet } from '../components/report-sheet';

// Seed: PUR-0001 buys 40 Double and 60 Triple at Artal for 8-18 May. CON-0001 and CON-0002
// sell 45 Double on 12-18 May, so 5 rooms a night, 30 room-nights, have no purchase.
const MAY = '?from=2027-05-01&to=2027-06-01';

const purchase = () => mockDb.get('purchases', 'purchase-1', purchaseSchema);

describe('profit & loss', () => {
  it('is partial while sold nights have no purchase, and complete once bought', async () => {
    renderApp(`/profit-loss${MAY}`);
    expect(await screen.findByText(/^Partial: 30 room-nights/)).toBeInTheDocument();
    cleanup();

    const original = await purchase();
    await mockDb.put('purchases', {
      ...original,
      id: 'purchase-extra',
      number: 'PUR-0060',
      checkIn: '2027-05-12',
      lines: [{ ...original?.lines[0], roomTypeId: 'double', rooms: 5 }],
    });
    renderApp(`/profit-loss${MAY}`);

    expect(await screen.findByText('Every sold room-night has a purchase')).toBeInTheDocument();
  });

  it('keeps its filters in the URL, and changes currency', async () => {
    const { user, router } = renderApp(`/profit-loss${MAY}`);
    await screen.findByText(/^Partial/);

    await user.selectOptions(screen.getByLabelText('Currency'), 'PKR');

    expect(router.state.location.search).toBe(`${MAY}&currency=PKR`);
    const summary = await screen.findByRole('region', { name: 'Summary' });
    const headline = within(summary).getByText('Profit so far').parentElement;
    await waitFor(() => {
      expect(within(headline ?? document.body).getByText(/^PKR /)).toBeInTheDocument();
    });
  });

  it('shows an exchange difference only when revaluing', async () => {
    const { user } = renderApp(`/profit-loss${MAY}&currency=PKR`);
    await screen.findByText(/^Partial/);
    expect(screen.queryByText('Exchange difference')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More filters' }));
    await user.selectOptions(screen.getByLabelText('Exchange rates'), 'revaluation');

    expect(await screen.findByText('Exchange difference')).toBeInTheDocument();
  });

  it('flags meal income with no meal bought', async () => {
    const original = await purchase();
    await mockDb.put('purchases', { ...original, id: 'purchase-1', meal: { pricing: 'none' } });

    renderApp(`/profit-loss${MAY}`);

    expect(await screen.findByText('Meal margin is overstated')).toBeInTheDocument();
  });

  it('shows termination adjustments dated in the period as their own line', async () => {
    await mockDb.put('adjustments', {
      id: 'adjustment-1',
      purchaseId: 'purchase-1',
      kind: 'penalty',
      effectiveDate: '2027-05-12',
      reason: 'Test',
      amount: { amount: '500', currencyCode: 'SAR', rateToPkr: '70', amountPkr: '35000.00' },
    });

    renderApp(`/profit-loss${MAY}`);

    const card = (await screen.findByText('Termination adjustments')).parentElement;
    expect(within(card ?? document.body).getByText('-SAR 500.00')).toBeInTheDocument();
  });

  it('says so when a currency has no rate on the rate date', async () => {
    renderApp(`/profit-loss${MAY}&currency=USD&on=2020-01-01`);

    expect(await screen.findByText('USD has no rate on 2020-01-01.')).toBeInTheDocument();
  });
});

describe('the other reports', () => {
  it('lists every report', async () => {
    renderApp('/reports');

    expect(await screen.findByRole('link', { name: /Vendor-wise margin/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Unsold cost exposure/ })).toBeInTheDocument();
  });

  it('adds up contracts signed in the period', async () => {
    renderApp('/reports/contracts');

    const table = await screen.findByRole('table', { name: 'Contract profitability' });
    expect(within(table).getByRole('link', { name: 'CON-0001' })).toBeInTheDocument();
    expect(within(table).getByText('Total')).toBeInTheDocument();
  });

  it('compares vendors at their actual rates, with unallocated rooms apart', async () => {
    renderApp(`/reports/vendors${MAY}`);

    const table = await screen.findByRole('table', { name: 'Vendor-wise margin' });
    expect(within(table).getByText('Sample Vendor A')).toBeInTheDocument();
    expect(within(table).getByText('No vendor allocated')).toBeInTheDocument();
  });

  it('groups sales by agent through the URL', async () => {
    const { user, router } = renderApp('/reports/sales');
    await screen.findByRole('table', { name: 'Sales' });

    await user.selectOptions(screen.getByLabelText('Group by'), 'agent');

    expect(router.state.location.search).toBe('?groupBy=agent');
    const table = await screen.findByRole('table', { name: 'Sales' });
    expect(await within(table).findByText('Sample Agent A')).toBeInTheDocument();
    expect(within(table).getByText('Sample Agent B')).toBeInTheDocument();
  });

  it('lists unsold nights with their cost', async () => {
    renderApp(`/reports/exposure${MAY}`);

    expect(await screen.findByRole('table', { name: 'Unsold cost exposure' })).toBeInTheDocument();
    expect(screen.getByText(/^Total unsold cost/)).toBeInTheDocument();
  });
});

describe('Excel rows', () => {
  it('hold the headers, real numbers and the total, as the table shows', () => {
    const columns = [
      {
        header: 'Name',
        cell: (row: { name: string; amount: string }) => row.name,
        value: (row: { name: string }) => row.name,
      },
      {
        header: 'Amount',
        isNumeric: true,
        cell: (row: { amount: string }) => row.amount,
        value: (row: { amount: string }) => Number(row.amount),
      },
    ];

    expect(toSheet('S', columns, [{ name: 'A', amount: '1.50' }], { name: 'Total', amount: '1.50' })).toEqual(
      {
        sheet: 'S',
        rows: [
          ['Name', 'Amount'],
          ['A', 1.5],
          ['Total', 1.5],
        ],
      },
    );
  });
});
