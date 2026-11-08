import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { purchaseSchema } from '@/features/purchases';
import { mockDb } from '@/mock-api/db';
import { renderApp } from '@/test/render';

import { contractSchema } from '../api/contract.schemas';

type User = ReturnType<typeof renderApp>['user'];

const stored = async (number: string) => {
  const contracts = await mockDb.list('contracts', contractSchema);
  return contracts.find((contract) => contract.number === number);
};

/** One Double a night is still free at Artal on 8 to 12 May: 40 bought, 25 sold, so 15. */
async function fillContract(user: User, rooms = '5') {
  await user.selectOptions(await screen.findByLabelText(/^Agent/), 'agent-a');
  await user.selectOptions(screen.getByLabelText(/^Hotel \*/), 'hotel-artal');
  await user.type(screen.getByLabelText(/^Check-in/), '2027-05-08');
  await user.type(screen.getByLabelText(/^Check-out/), '2027-05-12');
  await user.type(screen.getByLabelText(/^Double room rate/), '600');
  await user.selectOptions(screen.getByLabelText(/^Sold as/), 'double');
  await user.type(screen.getByLabelText(/^Rooms/), rooms);
  await user.tab();
}

const save = (user: User) => user.click(screen.getByRole('button', { name: 'Save as draft' }));

async function confirmDraft(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Confirm' }));
}

describe('contracts list', () => {
  it('shows each status in its tab, with tags, and keeps it in the URL', async () => {
    const { user, router } = renderApp('/contracts');
    const row = (await screen.findByRole('link', { name: 'CON-0002' })).closest('tr');

    expect(within(row ?? document.body).getByText('OVERBOOKED')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^Draft/ }));

    expect(await screen.findByRole('link', { name: 'CON-0003' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?status=draft');
  });

  it('filters by hotel through the URL', async () => {
    const { user, router } = renderApp('/contracts');
    await screen.findByRole('link', { name: 'CON-0001' });

    await user.selectOptions(screen.getByLabelText('Filter by hotel'), 'hotel-swissotel');

    expect(await screen.findByText('No confirmed contracts')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?hotel=hotel-swissotel');
  });

  it('finds a contract by hotel name', async () => {
    const { user } = renderApp('/contracts?status=draft');
    await screen.findByRole('link', { name: 'CON-0003' });
    const search = screen.getByRole('searchbox', { name: 'Search Contracts' });

    await user.type(search, 'Artal{Enter}');
    expect(await screen.findByText('Nothing matches “Artal”')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search Contracts' }), 'Swissotel{Enter}');
    expect(await screen.findByRole('link', { name: 'CON-0003' })).toBeInTheDocument();
  });
});

describe('adding a contract', () => {
  it('saves a draft with worked-out figures, and pre-fills whose rooms', async () => {
    const { user } = renderApp('/contracts/new');
    await fillContract(user);

    expect(screen.getByLabelText(/^Vendor rooms/)).toHaveValue(5);
    await save(user);

    expect(await screen.findByRole('heading', { name: 'CON-0005' })).toBeInTheDocument();
    const draft = await stored('CON-0005');
    expect(draft?.status).toBe('draft');
    // 5 rooms x 600 x 4 nights
    expect(draft?.total).toEqual({
      amount: '12000.00',
      currencyCode: 'SAR',
      rateToPkr: '70',
      amountPkr: '840000.00',
    });
    expect(draft?.hotels[0]?.lines[0]?.allocations).toEqual([
      { purchaseId: 'purchase-1', checkIn: '2027-05-08', checkOut: '2027-05-12', rooms: 5 },
    ]);
    expect(screen.getByRole('link', { name: 'PUR-0001' })).toBeInTheDocument();
  });

  it('charges meals, except at a hotel that opted out', async () => {
    const { user } = renderApp('/contracts/new');
    await fillContract(user);
    await user.selectOptions(screen.getByLabelText('Meal plan'), 'halfboard');
    expect(screen.getByLabelText(/^Meal rate/)).toHaveValue('75');
    await user.clear(screen.getByLabelText(/^Meal rate/));
    await user.type(screen.getByLabelText(/^Meal rate/), '20');
    await save(user);

    await screen.findByRole('heading', { name: 'CON-0005' });
    // 5 rooms x 2 persons x 4 nights x 20
    expect((await stored('CON-0005'))?.mealIncome.amount).toBe('800.00');
  });

  it('leaves meals off a hotel that opted out', async () => {
    const { user } = renderApp('/contracts/new');
    await fillContract(user);
    await user.selectOptions(screen.getByLabelText('Meal plan'), 'fullboard');
    await user.click(screen.getByLabelText('No meals at this hotel'));
    await save(user);

    await screen.findByRole('heading', { name: 'CON-0005' });
    expect((await stored('CON-0005'))?.mealIncome.amount).toBe('0.00');
    expect(screen.getByText('No meals at this hotel')).toBeInTheDocument();
  });

  it('holds several hotels, and adds them into the grand total', async () => {
    const { user } = renderApp('/contracts/new');
    await fillContract(user);
    await user.click(screen.getByRole('button', { name: 'Add hotel' }));
    await user.selectOptions(screen.getAllByLabelText(/^Hotel \*/)[1] ?? document.body, 'hotel-swissotel');
    await user.type(screen.getAllByLabelText(/^Check-in/)[1] ?? document.body, '2027-05-08');
    await user.type(screen.getAllByLabelText(/^Check-out/)[1] ?? document.body, '2027-05-09');
    await user.selectOptions(screen.getAllByLabelText(/^Rate type/)[1] ?? document.body, 'flat');
    await user.type(screen.getByLabelText(/^Flat rate/), '100');
    await user.selectOptions(screen.getAllByLabelText(/^Sold as/)[1] ?? document.body, 'quad');
    await user.type(screen.getAllByLabelText(/^Rooms/)[1] ?? document.body, '1');
    await save(user);

    await screen.findByRole('heading', { name: 'CON-0005' });
    const saved = await stored('CON-0005');
    expect(saved?.hotels.map((hotel) => hotel.total.amount)).toEqual(['12000.00', '100.00']);
    expect(saved?.total.amount).toBe('12100.00');
  });

  it('warns while typing when a line would overbook, without blocking', async () => {
    const { user } = renderApp('/contracts/new');
    await fillContract(user, '16');

    expect(await screen.findByText('This would overbook')).toBeInTheDocument();
    expect(screen.getByText(/^Artal International, Double: short by/)).toBeInTheDocument();
    await save(user);

    expect(await screen.findByRole('heading', { name: 'CON-0005' })).toBeInTheDocument();
  });

  it('offers only the sources the rules allow', async () => {
    const { user } = renderApp('/contracts/new');
    await fillContract(user);
    const source = screen.getByLabelText(/^Taken from/);
    expect(
      within(source)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Double']);
  });

  it('draws a converted line from the source pool, at the sold-as rate', async () => {
    await mockDb.put('conversionRules', {
      id: 'all:triple:double',
      hotelId: null,
      sourceTypeId: 'triple',
      soldAsTypeId: 'double',
      allowed: true,
    });
    const { user } = renderApp('/contracts/new');
    await fillContract(user);
    await user.selectOptions(screen.getByLabelText(/^Taken from/), 'triple');
    await save(user);

    await screen.findByRole('heading', { name: 'CON-0005' });
    const line = (await stored('CON-0005'))?.hotels[0]?.lines[0];
    expect(line).toMatchObject({ soldAsTypeId: 'double', sourceTypeId: 'triple', rate: '600' });
    expect(screen.getByText('from Triple')).toBeInTheDocument();
  });

  it('refuses vendor rooms above what is free', async () => {
    const { user } = renderApp('/contracts/new');
    await fillContract(user, '16');
    const vendorRooms = screen.getByLabelText(/^Vendor rooms/);
    expect(vendorRooms).toHaveValue(15);

    await user.clear(vendorRooms);
    await user.type(vendorRooms, '16');
    await save(user);

    expect(await screen.findByText('Only 15 free on these nights')).toBeInTheDocument();
    expect(await stored('CON-0005')).toBeUndefined();
  });

  it('saves a changed vendor split, and flags rooms left with no vendor', async () => {
    const { user } = renderApp('/contracts/new');
    await fillContract(user);
    const vendorRooms = screen.getByLabelText(/^Vendor rooms/);
    await user.clear(vendorRooms);
    await user.type(vendorRooms, '3');

    expect(screen.getByText(/^2 rooms have no vendor/)).toBeInTheDocument();
    await save(user);

    await screen.findByRole('heading', { name: 'CON-0005' });
    expect((await stored('CON-0005'))?.hotels[0]?.lines[0]?.allocations[0]?.rooms).toBe(3);
    expect(screen.getByText(/^Unallocated: 2 rooms/)).toBeInTheDocument();
  });

  it('leaves a chosen vendor alone when the stay changes, and points to the problem', async () => {
    const { user } = renderApp('/contracts/new');
    await fillContract(user);
    const checkOut = screen.getByLabelText(/^Check-out/);
    await user.clear(checkOut);
    await user.type(checkOut, '2027-05-10');
    await save(user);

    expect(await screen.findByText('Outside this stay')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Suggest again' }));
    await save(user);

    expect(await screen.findByRole('heading', { name: 'CON-0005' })).toBeInTheDocument();
  });

  it('refuses a stay that ends before it starts, and lists what is missing', async () => {
    const { user } = renderApp('/contracts/new');
    await screen.findByLabelText(/^Agent/);
    await save(user);

    const summary = await screen.findByRole('alert');
    expect(within(summary).getByRole('button', { name: 'Agent' })).toBeInTheDocument();
    expect(within(summary).getByRole('button', { name: 'Hotel 1: hotel' })).toBeInTheDocument();
  });
});

describe('confirming', () => {
  it('confirms without a warning when rooms are free, and reaches the ledger', async () => {
    const { user, router } = renderApp('/contracts/new');
    await fillContract(user);
    await save(user);
    await confirmDraft(user);
    await user.click(await screen.findByRole('button', { name: 'Confirm contract' }));

    await waitFor(async () => {
      expect((await stored('CON-0005'))?.status).toBe('confirmed');
    });
    expect(await screen.findByRole('button', { name: 'Cancel contract' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toBeInTheDocument();

    await router.navigate('/inventory/hotel-artal/double');
    const grid = await screen.findByRole('table', { name: 'Night by night' });
    // 40 bought, 25 + 5 sold on the first nights.
    expect(await within(grid).findByText('10')).toBeInTheDocument();
  });

  it('warns before overbooking: Go back leaves a draft, confirming saves with the tag', async () => {
    const { user } = renderApp('/contracts/new');
    await fillContract(user, '16');
    await save(user);
    await confirmDraft(user);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/^Artal International, Double: short by/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Go back' }));
    expect((await stored('CON-0005'))?.status).toBe('draft');

    await confirmDraft(user);
    await user.click(await screen.findByRole('button', { name: 'Confirm with overbooking' }));

    await waitFor(async () => {
      expect((await stored('CON-0005'))?.status).toBe('confirmed');
    });
    expect((await screen.findAllByText('OVERBOOKED')).length).toBeGreaterThan(0);
  });

  it('turns rooms another sale took meanwhile into Unallocated, with a message', async () => {
    const { user } = renderApp('/contracts/new');
    await fillContract(user, '10');
    await save(user);
    await screen.findByRole('heading', { name: 'CON-0005' });

    // Someone else takes the vendor's last rooms on those nights.
    const other = await stored('CON-0001');
    const [entry] = other?.hotels ?? [];
    const [line] = entry?.lines ?? [];
    if (!other || !entry || !line) throw new Error('expected the sample contract');
    await mockDb.put('contracts', {
      ...other,
      hotels: [
        {
          ...entry,
          lines: [
            { ...line, rooms: 25, allocations: [{ ...line.allocations[0], rooms: 25 }] },
            ...entry.lines.slice(1),
          ],
        },
      ],
    });

    await confirmDraft(user);
    await user.click(await screen.findByRole('button', { name: 'Confirm with overbooking' }));

    expect(await screen.findByText('Some rooms lost their vendor')).toBeInTheDocument();
    const saved = await stored('CON-0005');
    expect(saved?.status).toBe('confirmed');
    expect(saved?.hotels[0]?.lines[0]?.allocations[0]?.rooms).toBe(5);
  });

  it('clears the OVERBOOKED tag once the missing rooms are bought', async () => {
    const purchase = await mockDb.get('purchases', 'purchase-1', purchaseSchema);
    const { router } = renderApp('/contracts/contract-2');
    expect((await screen.findAllByText('OVERBOOKED')).length).toBeGreaterThan(0);

    await mockDb.put('purchases', {
      ...purchase,
      id: 'purchase-new',
      number: 'PUR-0009',
      lines: [{ ...purchase?.lines[0], roomTypeId: 'double', rooms: 5 }],
    });
    await router.navigate('/contracts');
    await router.navigate('/contracts/contract-2');

    await waitFor(() => {
      expect(screen.queryByText('OVERBOOKED')).not.toBeInTheDocument();
    });
    // The bought rooms have no sale on them yet, so the unallocated rooms now need a vendor.
    expect((await screen.findAllByText('Needs vendor')).length).toBeGreaterThan(0);
  });
});

describe('a saved contract', () => {
  it('cancelling gives the rooms back to the ledger', async () => {
    const { user, router } = renderApp('/contracts/contract-2');
    await user.click(await screen.findByRole('button', { name: 'Cancel contract' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Reason/), 'Agent withdrew');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel contract' }));
    await waitFor(async () => {
      expect((await stored('CON-0002'))?.status).toBe('cancelled');
    });

    await router.navigate('/inventory/hotel-artal/double');

    const grid = await screen.findByRole('table', { name: 'Night by night' });
    await waitFor(() => {
      expect(within(grid).queryByText(/^Overbooked/)).not.toBeInTheDocument();
    });
  });

  it('keeps its rates after the hotel reference rates change', async () => {
    await mockDb.put('hotels', {
      id: 'hotel-artal',
      name: 'Artal International',
      city: 'Madinah',
      active: true,
      rateCurrency: 'SAR',
      doubleRate: '9999',
    });

    renderApp('/contracts/contract-1');

    expect(await screen.findByText(/at SAR 600.00/)).toBeInTheDocument();
  });

  it('copies reference rates into a new contract', async () => {
    await mockDb.put('hotels', {
      id: 'hotel-artal',
      name: 'Artal International',
      city: 'Madinah',
      active: true,
      rateCurrency: 'SAR',
      doubleRate: '400',
      extraBedRate: '50',
    });
    const { user } = renderApp('/contracts/new');

    await user.selectOptions(await screen.findByLabelText(/^Hotel \*/), 'hotel-artal');

    expect(screen.getByLabelText(/^Double room rate/)).toHaveValue('400');
    expect(screen.getByLabelText(/^Extra bed rate/)).toHaveValue('50');
  });

  it('tells the user when someone else changed it first, and keeps their work', async () => {
    const { user, router } = renderApp('/contracts/contract-3/edit');
    await user.type(await screen.findByLabelText('Notes'), 'mine');
    const latest = await stored('CON-0003');
    await mockDb.put('contracts', { ...latest, id: 'contract-3', version: 9 });

    await save(user);

    expect(await screen.findByText('This could not be saved')).toBeInTheDocument();
    expect(screen.getByText(/changed by someone else/)).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toHaveValue('mine');
    expect(router.state.location.pathname).toBe('/contracts/contract-3/edit');
  });

  it('deletes a draft, and never reuses its number', async () => {
    const { user, router } = renderApp('/contracts/contract-3');
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Delete draft' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/contracts');
    });
    expect(await stored('CON-0003')).toBeUndefined();

    await router.navigate('/contracts/new');
    await fillContract(user);
    await save(user);

    expect(await screen.findByRole('heading', { name: 'CON-0005' })).toBeInTheDocument();
  });

  it('sends the edit address of a cancelled contract back to its page', async () => {
    const { router } = renderApp('/contracts/contract-4/edit');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/contracts/contract-4');
    });
  });

  it('asks before leaving unsaved work', async () => {
    const { user, router } = renderApp('/contracts/new');
    await user.type(await screen.findByLabelText('Notes'), 'half typed');

    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(await screen.findByText('Discard your changes?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/contracts');
    });
  });
});
