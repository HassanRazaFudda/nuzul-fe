import { describe, expect, it } from 'vitest';

import { impactOf } from './impact';

const purchase = (rooms: number, checkOut = '2027-05-05') => ({
  id: 'p',
  number: 'p',
  hotelId: 'h',
  checkIn: '2027-05-01',
  checkOut,
  lines: [{ roomTypeId: 'd', rooms }],
});
const sale = (rooms: number) => ({
  id: 's',
  contractId: 'c',
  reference: 'c',
  hotelId: 'h',
  roomTypeId: 'd',
  checkIn: '2027-05-01',
  checkOut: '2027-05-05',
  rooms,
});
const before = { purchases: [purchase(20)], sales: [sale(12)] };

describe('impactOf', () => {
  // business-workflows.md §4: 20 bought, 12 sold.
  it('releasing 8 rooms leaves the sales covered', () => {
    const impact = impactOf(before, { purchases: [purchase(12)], sales: [sale(12)] });

    expect(impact.worsens).toBe(false);
    expect(impact.pools).toEqual([
      {
        hotelId: 'h',
        roomTypeId: 'd',
        rows: [
          {
            from: expect.any(Number) as number,
            to: expect.any(Number) as number,
            before: { purchased: 20, sold: 12, available: 8 },
            after: { purchased: 12, sold: 12, available: 0 },
          },
        ],
      },
    ]);
  });

  it('releasing 10 leaves every night 2 short', () => {
    const impact = impactOf(before, { purchases: [purchase(10)], sales: [sale(12)] });

    expect(impact.worsens).toBe(true);
    expect(impact.pools[0]?.rows[0]?.after.available).toBe(-2);
  });

  it('lists only the nights that change', () => {
    const impact = impactOf(before, { purchases: [purchase(20, '2027-05-03')], sales: [sale(12)] });

    const rows = impact.pools[0]?.rows ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.to).toBe((rows[0]?.from ?? 0) + 2);
    expect(rows[0]?.after).toEqual({ purchased: 0, sold: 12, available: -12 });
  });

  it('finds nothing when nothing changes', () => {
    expect(impactOf(before, before)).toEqual({ pools: [], lostCover: [], worsens: false });
  });

  it('lists the rooms that lose their vendor, by block of nights', () => {
    const covered = {
      ...sale(12),
      contractVersion: 1,
      hotelIndex: 0,
      lineIndex: 0,
      soldAsTypeId: 'd',
      allocations: [{ purchaseId: 'p', checkIn: '2027-05-01', checkOut: '2027-05-05', rooms: 12 }],
    };
    const cut = {
      ...covered,
      allocations: [{ purchaseId: 'p', checkIn: '2027-05-01', checkOut: '2027-05-03', rooms: 12 }],
    };

    const impact = impactOf(before, before, { before: [covered], after: [cut] });

    expect(impact.lostCover).toEqual([
      expect.objectContaining({ checkIn: '2027-05-03', checkOut: '2027-05-05', rooms: 12 }),
    ]);
  });
});
