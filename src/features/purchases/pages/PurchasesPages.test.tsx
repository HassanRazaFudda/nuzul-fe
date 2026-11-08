import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { hotelSchema } from '@/features/hotels';
import { mockDb } from '@/mock-api/db';
import { renderApp } from '@/test/render';

import { purchaseSchema } from '../api/purchase.schemas';

type User = ReturnType<typeof renderApp>['user'];

const stored = async (number: string) => {
  const purchases = await mockDb.list('purchases', purchaseSchema);
  return purchases.find((purchase) => purchase.number === number);
};

async function fillHeader(user: User) {
  await user.selectOptions(await screen.findByLabelText(/^Hotel/), 'hotel-artal');
  await user.selectOptions(screen.getByLabelText(/^Vendor/), 'vendor-a');
  await user.type(screen.getByLabelText(/^Check-in/), '2027-05-08');
  await user.type(screen.getByLabelText(/^Check-out/), '2027-05-11');
}

async function fillLine(user: User, type = 'double', rooms = '5', rate = '100') {
  await user.selectOptions(screen.getByLabelText(/^Room type/), type);
  await user.type(screen.getByLabelText(/^Rooms/), rooms);
  await user.type(screen.getByLabelText(/^Cost rate/), rate);
}

describe('purchases list', () => {
  it('shows each status in its tab, kept in the URL', async () => {
    const { user, router } = renderApp('/purchases');
    expect(await screen.findByRole('link', { name: 'PUR-0001' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'PUR-0002' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^Draft/ }));

    expect(await screen.findByRole('link', { name: 'PUR-0002' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?status=draft');
  });

  it('filters by hotel through the URL', async () => {
    const { user, router } = renderApp('/purchases');
    await screen.findByRole('link', { name: 'PUR-0001' });

    await user.selectOptions(screen.getByLabelText('Filter by hotel'), 'hotel-swissotel');

    expect(await screen.findByText('No confirmed purchases')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?hotel=hotel-swissotel');
  });

  it('finds a purchase by vendor name', async () => {
    const { user } = renderApp('/purchases');
    await screen.findByRole('link', { name: 'PUR-0001' });
    const search = screen.getByRole('searchbox', { name: 'Search Purchases' });

    // PUR-0001 is bought from Vendor A.
    await user.type(search, 'Vendor B{Enter}');
    expect(await screen.findByText('Nothing matches “Vendor B”')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search Purchases' }), 'Vendor A{Enter}');

    expect(await screen.findByRole('link', { name: 'PUR-0001' })).toBeInTheDocument();
    expect(screen.queryByText(/^Nothing matches/)).not.toBeInTheDocument();
  });

  it('still names a hotel that has since been deactivated', async () => {
    const hotel = await mockDb.get('hotels', 'hotel-artal', hotelSchema);
    await mockDb.put('hotels', { ...hotel, id: 'hotel-artal', active: false });

    renderApp('/purchases');

    expect(await screen.findByText('Artal International')).toBeInTheDocument();
  });
});

describe('adding a purchase', () => {
  it('saves a draft with worked-out figures, then confirming moves it', async () => {
    const { user, router } = renderApp('/purchases/new');
    await fillHeader(user);
    await fillLine(user);

    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByRole('heading', { name: 'PUR-0004' })).toBeInTheDocument();
    const draft = await stored('PUR-0004');
    expect(draft?.status).toBe('draft');
    expect(draft?.total).toEqual({
      amount: '1500.00',
      currencyCode: 'SAR',
      rateToPkr: '70',
      amountPkr: '105000.00',
    });

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm purchase' }));
    await waitFor(async () => {
      expect((await stored('PUR-0004'))?.status).toBe('confirmed');
    });
    expect(router.state.location.pathname).toMatch(/^\/purchases\//);
    expect(await screen.findByRole('button', { name: 'Cancel purchase' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Terminate' })).toBeInTheDocument();
  });

  it('shows live totals while typing', async () => {
    const { user } = renderApp('/purchases/new');
    await fillHeader(user);
    await fillLine(user);

    const totals = within(
      screen.getByRole('heading', { name: 'Totals' }).closest('section') ?? document.body,
    );

    expect(totals.getAllByText('SAR 1,500.00')).not.toHaveLength(0);
    expect(totals.getByText('PKR 105,000.00')).toBeInTheDocument();
  });

  it('refuses check-out that is not after check-in', async () => {
    const { user } = renderApp('/purchases/new');
    await user.selectOptions(await screen.findByLabelText(/^Hotel/), 'hotel-artal');
    await user.selectOptions(screen.getByLabelText(/^Vendor/), 'vendor-a');
    await user.type(screen.getByLabelText(/^Check-in/), '2027-05-08');
    await user.type(screen.getByLabelText(/^Check-out/), '2027-05-08');
    await fillLine(user);

    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByText('Check-out must be after check-in')).toBeInTheDocument();
    expect(await stored('PUR-0004')).toBeUndefined();
  });

  it('lists what is missing, and refuses a duplicate room type', async () => {
    const { user } = renderApp('/purchases/new');
    await fillHeader(user);
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));
    const summary = await screen.findByRole('alert');
    expect(within(summary).getByRole('button', { name: 'Line 1: room type' })).toBeInTheDocument();

    await fillLine(user);
    await user.click(screen.getByRole('button', { name: 'Add room line' }));
    await user.selectOptions(screen.getAllByLabelText(/^Room type/)[1] ?? document.body, 'double');
    await user.type(screen.getAllByLabelText(/^Rooms/)[1] ?? document.body, '2');
    await user.type(screen.getAllByLabelText(/^Cost rate/)[1] ?? document.body, '100');
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByText('This room type is already on the purchase')).toBeInTheDocument();
  });

  it('asks for meal details only when meals are separate, and defaults persons from the type', async () => {
    const { user } = renderApp('/purchases/new');
    await fillHeader(user);
    await fillLine(user, 'triple');
    expect(screen.queryByLabelText(/^Meal rate\W*$/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Meal arrangement'), 'separate');

    expect(screen.getByLabelText(/^Persons per room/)).toHaveValue(3);
    await user.type(screen.getByLabelText(/^Meal rate\W*$/), '10');
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    await screen.findByRole('heading', { name: 'PUR-0004' });
    // 5 rooms x 3 persons x 3 nights x 10
    expect((await stored('PUR-0004'))?.mealCost.amount).toBe('450.00');
  });

  it('applies one rate to every line, and a whole-stay rate ignores nights', async () => {
    const { user } = renderApp('/purchases/new');
    await fillHeader(user);
    await user.click(screen.getByLabelText('Same rate for all lines'));
    await user.click(screen.getByLabelText('Rate is per night'));
    await user.type(screen.getByLabelText(/^Rate for all lines/), '200');
    await user.selectOptions(screen.getByLabelText(/^Room type/), 'double');
    await user.type(screen.getByLabelText(/^Rooms/), '2');
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    await screen.findByRole('heading', { name: 'PUR-0004' });
    const saved = await stored('PUR-0004');
    expect(saved?.lines[0]?.rate).toBe('200');
    expect(saved?.total.amount).toBe('400.00');
  });

  it('warns about a zero cost rate, without blocking it', async () => {
    const { user } = renderApp('/purchases/new');
    await fillHeader(user);
    await fillLine(user, 'double', '1', '0');

    expect(screen.getByText(/A cost rate of zero/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByRole('heading', { name: 'PUR-0004' })).toBeInTheDocument();
  });

  it('pre-fills a rate from the hotel only in the same currency', async () => {
    await mockDb.put('hotels', {
      id: 'hotel-artal',
      name: 'Artal International',
      city: 'Madinah',
      active: true,
      rateCurrency: 'SAR',
      doubleRate: '400',
      extraBedRate: '50',
    });
    const { user } = renderApp('/purchases/new');
    await user.selectOptions(await screen.findByLabelText(/^Hotel/), 'hotel-artal');

    await user.selectOptions(screen.getByLabelText(/^Room type/), 'quad');
    expect(screen.getByLabelText(/^Cost rate/)).toHaveValue('500');

    await user.clear(screen.getByLabelText(/^Cost rate/));
    await user.selectOptions(screen.getByLabelText(/^Currency/), 'USD');
    await user.selectOptions(screen.getByLabelText(/^Room type/), 'double');
    expect(screen.getByLabelText(/^Cost rate/)).toHaveValue('');
  });

  it('asks before leaving unsaved work', async () => {
    const { user, router } = renderApp('/purchases/new');
    await user.type(await screen.findByLabelText('Notes'), 'half typed');

    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(await screen.findByText('Discard your changes?')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/purchases/new');

    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/purchases');
    });
  });
});

describe('a saved purchase', () => {
  it('keeps its frozen rate after the currency rate changes', async () => {
    await mockDb.put('exchangeRates', {
      id: 'rate-new',
      currencyCode: 'SAR',
      rateToPkr: '99',
      effectiveFrom: '2026-01-02',
    });
    renderApp('/purchases/purchase-1');

    expect(await screen.findByText('1 SAR = 70 PKR')).toBeInTheDocument();
    expect(screen.getByText('PKR 41,300,000.00')).toBeInTheDocument();
  });

  it('tells the user when someone else changed it first, and keeps their work', async () => {
    const { user, router } = renderApp('/purchases/purchase-2/edit');
    await user.type(await screen.findByLabelText('Notes'), 'mine');
    const latest = await stored('PUR-0002');
    await mockDb.put('purchases', { ...latest, id: 'purchase-2', version: 9 });

    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByText('This could not be saved')).toBeInTheDocument();
    expect(screen.getByText(/changed by someone else/)).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toHaveValue('mine');
    expect(router.state.location.pathname).toBe('/purchases/purchase-2/edit');
  });

  it('cancels a confirmed purchase with a reason, and offers nothing afterwards', async () => {
    const { user } = renderApp('/purchases/purchase-1');
    await user.click(await screen.findByRole('button', { name: 'Cancel purchase' }));
    const dialog = await screen.findByRole('dialog');

    // It backs CON-0001 and CON-0002, so the preview lists them.
    expect(within(dialog).getByText('Sales losing their vendor')).toBeInTheDocument();
    expect(within(dialog).getAllByText(/^CON-0001/).length).toBeGreaterThan(0);
    await user.click(within(dialog).getByRole('button', { name: /^Cancel purchase/ }));
    expect(await within(dialog).findByText('Enter the reason for this change')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/^Reason/), 'Vendor withdrew');
    await user.click(within(dialog).getByRole('button', { name: /^Cancel purchase/ }));

    await waitFor(async () => {
      expect((await stored('PUR-0001'))?.status).toBe('cancelled');
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel purchase' })).not.toBeInTheDocument();
    });
  });

  it('deletes a draft, and never reuses its number', async () => {
    const { user, router } = renderApp('/purchases/purchase-2');
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Delete draft' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/purchases');
    });
    expect(await stored('PUR-0002')).toBeUndefined();
    await router.navigate('/purchases/new');
    await fillHeader(user);
    await fillLine(user);
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    expect(await screen.findByRole('heading', { name: 'PUR-0004' })).toBeInTheDocument();
  });

  it('sends the edit address of a cancelled purchase back to its page', async () => {
    const { router } = renderApp('/purchases/purchase-3/edit');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/purchases/purchase-3');
    });
  });
});
