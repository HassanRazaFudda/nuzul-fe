import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { contractSchema } from '@/features/contracts';
import { purchaseSchema } from '@/features/purchases';
import { mockDb } from '@/mock-api/db';
import { renderApp } from '@/test/render';

type User = ReturnType<typeof renderApp>['user'];

const contract = (id: string) => mockDb.get('contracts', id, contractSchema);
const purchase = (id: string) => mockDb.get('purchases', id, purchaseSchema);

/** Seed: PUR-0001 (Artal, 8-18 May) supplies CON-0001 (15 Double, 60 Triple) and CON-0002. */
async function startTermination(effectiveDate: string) {
  const { user } = renderApp('/purchases/purchase-1/terminate');
  await user.type(await screen.findByLabelText(/^First released night/), effectiveDate);
  await user.type(screen.getByLabelText(/^Reason \*/), 'Hotel closed for works');
  return user;
}

const rowFor = (reference: string, type: string) => {
  const row = screen
    .getAllByRole('listitem')
    .find(
      (item) =>
        item.querySelector('select') !== null &&
        item.textContent.startsWith(reference) &&
        item.textContent.includes(type),
    );
  if (!row) throw new Error(`no row for ${reference} ${type}`);
  return within(row);
};

async function decide(user: User, reference: string, type: string, kind: string, extra?: string) {
  const row = rowFor(reference, type);
  await user.selectOptions(row.getByLabelText(/^Decision/), kind);
  if (kind === 'resource' && extra) await user.selectOptions(row.getByLabelText(/^Take rooms from/), extra);
  if ((kind === 'cancel' || kind === 'accept') && extra)
    await user.type(row.getByLabelText(/^Reason/), extra);
}

async function finish(user: User) {
  await user.click(screen.getByRole('button', { name: 'Terminate purchase' }));
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: /^Terminate/ }));
}

describe('editing a confirmed purchase', () => {
  it('shows what the change does, needs a reason, and keeps a history', async () => {
    const { user } = renderApp('/purchases/purchase-1/edit');
    const rooms = (await screen.findAllByLabelText(/^Rooms/))[0];
    if (!rooms) throw new Error('expected the Double line');
    await user.clear(rooms);
    await user.type(rooms, '45');
    await user.click(screen.getByRole('button', { name: 'Review changes' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText(/40 → 45/).length).toBeGreaterThan(0);
    await user.type(within(dialog).getByLabelText(/^Reason/), 'Vendor added rooms');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('heading', { name: 'PUR-0001' })).toBeInTheDocument();
    expect((await purchase('purchase-1'))?.lines[0]?.rooms).toBe(45);
    expect(await screen.findByText('Vendor added rooms')).toBeInTheDocument();
  });

  it('releasing rooms that are sold asks to save with overbooking, and unallocates the excess', async () => {
    const { user } = renderApp('/purchases/purchase-1/edit');
    const rooms = (await screen.findAllByLabelText(/^Rooms/))[0];
    if (!rooms) throw new Error('expected the Double line');
    await user.clear(rooms);
    await user.type(rooms, '20');
    await user.click(screen.getByRole('button', { name: 'Review changes' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('This overbooks')).toBeInTheDocument();
    expect(within(dialog).getByText('Sales losing their vendor')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/^Reason/), 'Partial release');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes with overbooking' }));

    await screen.findByRole('heading', { name: 'PUR-0001' });
    // CON-0001, the older sale, keeps its 15; CON-0002 keeps the 5 left.
    const second = await contract('contract-2');
    expect(second?.hotels[0]?.lines[0]?.allocations[0]?.rooms).toBe(5);
    expect(second?.version).toBe(3);
  });

  it('refuses a save when the records changed after the preview', async () => {
    const { user } = renderApp('/purchases/purchase-1/edit');
    const rooms = (await screen.findAllByLabelText(/^Rooms/))[0];
    if (!rooms) throw new Error('expected the Double line');
    await user.clear(rooms);
    await user.type(rooms, '41');
    await user.click(screen.getByRole('button', { name: 'Review changes' }));
    const dialog = await screen.findByRole('dialog');

    const other = await contract('contract-2');
    await mockDb.put('contracts', { ...other, id: 'contract-2', version: 7 });
    await user.type(within(dialog).getByLabelText(/^Reason/), 'More rooms');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await within(dialog).findByText(/changed by someone else/)).toBeInTheDocument();
    expect((await purchase('purchase-1'))?.lines[0]?.rooms).toBe(40);
  });
});

describe('editing a confirmed contract', () => {
  it('reviews an overbooking change before saving it', async () => {
    const { user } = renderApp('/contracts/contract-1/edit');
    const rooms = (await screen.findAllByLabelText(/^Rooms/))[0];
    if (!rooms) throw new Error('expected the Double line');
    await user.clear(rooms);
    await user.type(rooms, '20');
    await user.click(screen.getByRole('button', { name: 'Review changes' }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Reason/), 'Agent wants more');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes with overbooking' }));

    await screen.findByRole('heading', { name: 'CON-0001' });
    const saved = await contract('contract-1');
    expect(saved?.status).toBe('confirmed');
    expect(saved?.hotels[0]?.lines[0]?.rooms).toBe(20);
    expect(await screen.findByText('Agent wants more')).toBeInTheDocument();
  });
});

describe('terminating a purchase', () => {
  it('cannot finish while a line has no decision', async () => {
    const user = await startTermination('2027-05-12');

    await user.click(screen.getByRole('button', { name: 'Terminate purchase' }));

    const summary = await screen.findByRole('alert');
    expect(within(summary).getByRole('button', { name: 'CON-0001 Double: decision' })).toBeInTheDocument();
    expect((await purchase('purchase-1'))?.status).toBe('confirmed');
  });

  it('applies each decision, and keeps the nights before the effective date', async () => {
    const user = await startTermination('2027-05-12');
    await user.type(screen.getByLabelText(/^Penalty paid$/), '500');
    await decide(user, 'CON-0001', 'Double', 'accept', 'Will buy later');
    await decide(user, 'CON-0001', 'Triple', 'cancel', 'Agent agreed');
    await decide(user, 'CON-0002', 'Double', 'cancel', 'Agent agreed');

    await finish(user);

    expect(await screen.findByRole('heading', { name: 'PUR-0001' })).toBeInTheDocument();
    const terminated = await purchase('purchase-1');
    expect(terminated?.status).toBe('terminated');
    expect(terminated?.termination).toEqual({
      terminationDate: expect.any(String) as string,
      effectiveDate: '2027-05-12',
      reason: 'Hotel closed for works',
    });

    const first = await contract('contract-1');
    expect(first?.status).toBe('confirmed');
    expect(first?.hotels[0]?.lines).toHaveLength(1);
    expect(first?.hotels[0]?.lines[0]?.allocations).toEqual([
      { purchaseId: 'purchase-1', checkIn: '2027-05-08', checkOut: '2027-05-12', rooms: 15 },
    ]);
    // CON-0002 keeps its first hotel, and is repriced.
    const second = await contract('contract-2');
    expect(second?.hotels).toHaveLength(1);
    expect(second?.total.amount).toBe('26000.00');

    expect(screen.getByText('Penalty paid')).toBeInTheDocument();
    expect(screen.getByText('Penalty paid').nextElementSibling).toHaveTextContent(/^SAR 500.00/);

    const { revisionsApi } = await import('@/features/changes');
    const history = await revisionsApi.list('contract', 'contract-1');
    expect(history.map((entry) => entry.reason)).toContain('PUR-0001 terminated: Will buy later');
  });

  it('cancels the contract when its last line is cancelled', async () => {
    const user = await startTermination('2027-05-09');
    await decide(user, 'CON-0001', 'Double', 'accept', 'Short');
    await decide(user, 'CON-0001', 'Triple', 'accept', 'Short');
    const lines = screen
      .getAllByRole('listitem')
      .filter((item) => item.querySelector('select') !== null && item.textContent.startsWith('CON-0002'));
    for (const line of lines) {
      await user.selectOptions(within(line).getByLabelText(/^Decision/), 'cancel');
      await user.type(within(line).getByLabelText(/^Reason/), 'Agent agreed');
    }

    await finish(user);

    await screen.findByRole('heading', { name: 'PUR-0001' });
    expect((await contract('contract-2'))?.status).toBe('cancelled');
  });

  it('re-sources lines to another vendor with free rooms', async () => {
    const original = await purchase('purchase-1');
    if (!original) throw new Error('expected the seed purchase');
    await mockDb.put('purchases', {
      ...original,
      id: 'purchase-spare',
      number: 'PUR-0050',
      vendorId: 'vendor-b',
      checkIn: '2027-05-12',
      lines: [{ ...original.lines[0], roomTypeId: 'double', rooms: 40 }],
    });
    const user = await startTermination('2027-05-12');
    await decide(user, 'CON-0001', 'Double', 'resource', 'double');
    expect(
      rowFor('CON-0001', 'Double').getByText('Every room on this line has a vendor.'),
    ).toBeInTheDocument();
    await decide(user, 'CON-0001', 'Triple', 'cancel', 'Agent agreed');
    await decide(user, 'CON-0002', 'Double', 'resource', 'double');

    await finish(user);

    await screen.findByRole('heading', { name: 'PUR-0001' });
    const first = await contract('contract-1');
    expect(first?.hotels[0]?.lines[0]?.allocations).toContainEqual({
      purchaseId: 'purchase-spare',
      checkIn: '2027-05-12',
      checkOut: '2027-05-18',
      rooms: 15,
    });
  });

  it('refuses a first released night outside the stay', async () => {
    const user = await startTermination('2027-05-08');

    await user.click(screen.getByRole('button', { name: 'Terminate purchase' }));

    expect(await screen.findByText(/To release every night, cancel instead/)).toBeInTheDocument();
  });

  it('leaves the ledger counting only nights before the effective date', async () => {
    const user = await startTermination('2027-05-12');
    await decide(user, 'CON-0001', 'Double', 'cancel', 'x');
    await decide(user, 'CON-0001', 'Triple', 'cancel', 'x');
    await decide(user, 'CON-0002', 'Double', 'cancel', 'x');
    await finish(user);
    await screen.findByRole('heading', { name: 'PUR-0001' });

    const { router } = renderApp('/inventory/hotel-artal/triple');
    expect(router.state.location.pathname).toBe('/inventory/hotel-artal/triple');

    const grid = await screen.findByRole('table', { name: 'Night by night' });
    const rows = within(grid).getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(within(rows[1] ?? grid).getByText('(12 May 2027)')).toBeInTheDocument();
  });
});
