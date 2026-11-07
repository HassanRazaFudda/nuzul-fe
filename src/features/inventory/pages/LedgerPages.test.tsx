import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { mockDb } from '@/mock-api/db';
import { renderApp } from '@/test/render';

import { sampleSaleSchema } from '../api/ledger.schemas';

const DOUBLE_POOL = '/inventory/hotel-artal/double';

describe('the ledger overview', () => {
  it('lists pools with the overbooked one first', async () => {
    renderApp('/inventory');

    const table = await screen.findByRole('table', { name: 'Rooms ledger' });
    await within(table).findByText('Overbooked by 5');
    const rows = within(table).getAllByRole('row');
    expect(
      within(rows[1] ?? table).getByRole('link', { name: 'Artal International Double' }),
    ).toBeInTheDocument();
    expect(within(rows[2] ?? table).getByText('Fully utilised')).toBeInTheDocument();
  });

  it('keeps the state filter in the URL', async () => {
    const { user, router } = renderApp('/inventory');
    await screen.findByText('Overbooked by 5');

    await user.selectOptions(screen.getByLabelText('Filter by state'), 'full');

    await waitFor(() => {
      expect(screen.queryByText('Overbooked by 5')).not.toBeInTheDocument();
    });
    const table = screen.getByRole('table', { name: 'Rooms ledger' });
    expect(within(table).getByText('Fully utilised')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?status=full');
  });

  it('reads the hotel filter from the URL, and explains an empty result', async () => {
    renderApp('/inventory?hotel=hotel-swissotel');

    expect(await screen.findByText('Nothing on the ledger here')).toBeInTheDocument();
  });

  it('leaves out drafts and cancelled purchases', async () => {
    renderApp('/inventory');
    await screen.findByText('Overbooked by 5');
    const table = screen.getByRole('table', { name: 'Rooms ledger' });

    // PUR-0002 is a draft at Swissotel, PUR-0003 is cancelled at Dar Al Eiman.
    expect(within(table).queryByText('Swissotel Al Maqam')).not.toBeInTheDocument();
    expect(within(table).queryByText('Dar Al Eiman Royal')).not.toBeInTheDocument();
  });
});

describe('a pool', () => {
  it('shows the grid first, then what to buy, then the Result', async () => {
    renderApp(DOUBLE_POOL);

    const grid = await screen.findByRole('table', { name: 'Night by night' });
    const result = screen.getByRole('table', { name: 'Result by date range' });
    const buy = screen.getByRole('link', { name: 'Purchase 5 rooms' });
    expect(within(grid).getByText('-5')).toBeInTheDocument();
    expect(within(grid).getByText('Overbooked by 5')).toBeInTheDocument();
    expect(grid.compareDocumentPosition(buy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(buy.compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('warns when the Result hides a shortage', async () => {
    await mockDb.remove('sampleSales', 'sample-2');
    await mockDb.remove('sampleSales', 'sample-3');
    await mockDb.remove('sampleSales', 'sample-1');
    await mockDb.put('purchases', {
      ...(await mockDb.get('purchases', 'purchase-1', sampleSaleSchema.pick({ id: true }).loose())),
      id: 'purchase-1',
      checkIn: '2027-05-04',
      checkOut: '2027-05-12',
      lines: [
        {
          roomTypeId: 'double',
          rooms: 82,
          rate: '500',
          personsPerRoom: 2,
          cost: { amount: '0', currencyCode: 'SAR', rateToPkr: '70', amountPkr: '0' },
        },
      ],
    });
    const sale = (id: string, checkIn: string, checkOut: string, rooms: number) =>
      mockDb.put('sampleSales', {
        id,
        reference: id,
        hotelId: 'hotel-artal',
        roomTypeId: 'double',
        checkIn,
        checkOut,
        rooms,
      });
    await sale('a', '2027-05-08', '2027-05-14', 23);
    await sale('b', '2027-05-05', '2027-05-10', 10);
    await sale('c', '2027-05-08', '2027-05-12', 17);

    renderApp(DOUBLE_POOL);

    expect(await screen.findByText('This summary hides a shortage')).toBeInTheDocument();
    expect(screen.getAllByText('Overbooked by 23')).not.toHaveLength(0);
  });

  it('clears the shortage once the suggested purchase is confirmed', async () => {
    const { user, router } = renderApp(DOUBLE_POOL);
    await user.click(await screen.findByRole('link', { name: 'Purchase 5 rooms' }));

    expect(await screen.findByLabelText(/^Hotel/)).toHaveValue('hotel-artal');
    expect(screen.getByLabelText(/^Check-in/)).toHaveValue('2027-05-12');
    expect(screen.getByLabelText(/^Check-out/)).toHaveValue('2027-05-18');
    expect(screen.getByLabelText(/^Room type/)).toHaveValue('double');
    expect(screen.getByLabelText(/^Rooms/)).toHaveValue(5);

    await user.selectOptions(screen.getByLabelText(/^Vendor/), 'vendor-b');
    await user.type(screen.getByLabelText(/^Cost rate/), '100');
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm purchase' }));
    await screen.findByRole('button', { name: 'Cancel purchase' });

    await router.navigate(DOUBLE_POOL);

    const grid = await screen.findByRole('table', { name: 'Night by night' });
    await waitFor(() => {
      expect(within(grid).queryByText(/^Overbooked/)).not.toBeInTheDocument();
    });
    expect(within(grid).getByText('Fully utilised')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Purchase / })).not.toBeInTheDocument();
  });

  it('shows the shortage again when a purchase is cancelled', async () => {
    const { user, router } = renderApp('/purchases/purchase-1');
    await user.click(await screen.findByRole('button', { name: 'Cancel purchase' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel purchase' }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel purchase' })).not.toBeInTheDocument();
    });

    await router.navigate('/inventory/hotel-artal/triple');

    expect(await screen.findAllByText('Overbooked by 60')).not.toHaveLength(0);
  });

  it('adds and removes a sample sale, and the figures follow', async () => {
    const { user } = renderApp('/inventory/hotel-artal/triple');
    await screen.findAllByText('Fully utilised');
    await user.click(screen.getByRole('button', { name: 'Add sample sale' }));
    await user.type(screen.getByLabelText(/^Check-in/), '2027-05-08');
    await user.type(screen.getByLabelText(/^Check-out/), '2027-05-09');
    await user.type(screen.getByLabelText(/^Rooms/), '2');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findAllByText('Overbooked by 2')).not.toHaveLength(0);
    const added = (await mockDb.list('sampleSales', sampleSaleSchema)).find((sale) => sale.rooms === 2);
    await user.click(screen.getByRole('button', { name: `Remove ${added?.reference ?? ''}` }));

    await waitFor(() => {
      expect(screen.queryByText('Overbooked by 2')).not.toBeInTheDocument();
    });
  });

  it('says so when nothing is on the pool', async () => {
    renderApp('/inventory/hotel-swissotel/double');

    expect(await screen.findByText('Nothing on this pool')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export to Excel' })).not.toBeInTheDocument();
  });
});

describe('the suggested purchase link', () => {
  it('ignores values in the address that make no sense', async () => {
    renderApp('/purchases/new?hotel=nope&roomType=nope&checkIn=nonsense&checkOut=2027-13-45&rooms=-3');

    expect(await screen.findByLabelText(/^Hotel/)).toHaveValue('');
    expect(screen.getByLabelText(/^Check-in/)).toHaveValue('');
    expect(screen.getByLabelText(/^Check-out/)).toHaveValue('');
    expect(screen.getByLabelText(/^Room type/)).toHaveValue('');
    expect(screen.getByLabelText(/^Rooms/)).toHaveValue(null);
  });

  it('asks before leaving a pre-filled form', async () => {
    const { user } = renderApp('/purchases/new?hotel=hotel-artal&rooms=5');

    await user.click(await screen.findByRole('link', { name: 'Cancel' }));

    expect(await screen.findByText('Discard your changes?')).toBeInTheDocument();
  });
});

describe('the overview page', () => {
  it('counts overbooked pools and links to them', async () => {
    const { user, router } = renderApp('/');

    await user.click(await screen.findByRole('link', { name: '1' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/inventory');
    });
    expect(router.state.location.search).toBe('?status=overbooked');
  });
});
