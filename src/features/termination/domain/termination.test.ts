import { describe, expect, it } from 'vitest';

import type { LedgerPurchase, LedgerSale } from '@/features/inventory';
import { purchaseChange } from '@/features/purchases';

import { affectedLines, applyTermination } from './termination';

const purchase = (
  id: string,
  rooms: number,
  roomTypeId = 'double',
  checkIn = '2027-05-01',
): LedgerPurchase => ({
  id,
  number: id,
  hotelId: 'h',
  vendorId: `vendor-${id}`,
  vendorName: `Vendor ${id}`,
  checkIn,
  checkOut: '2027-05-09',
  lines: [{ roomTypeId, rooms }],
});

const sale = (id: string, rooms: number, purchaseId: string, roomTypeId = 'double'): LedgerSale => ({
  id,
  contractId: `contract-${id}`,
  contractVersion: 1,
  hotelIndex: 0,
  lineIndex: 0,
  reference: `CON-${id}`,
  hotelId: 'h',
  soldAsTypeId: 'double',
  roomTypeId,
  checkIn: '2027-05-01',
  checkOut: '2027-05-09',
  rooms,
  allocations: [{ purchaseId, checkIn: '2027-05-01', checkOut: '2027-05-09', rooms }],
});

const A = purchase('A', 10);
const EFFECTIVE = '2027-05-05';

describe('purchaseChange', () => {
  it('unallocates what a shrunk purchase no longer supplies, and never moves it', () => {
    const B = purchase('B', 10);
    const change = purchaseChange({ purchases: [A, B], sales: [sale('1', 6, 'A'), sale('2', 4, 'A')] }, 'A', {
      ...A,
      lines: [{ roomTypeId: 'double', rooms: 7 }],
    });

    // The older sale keeps its 6; the next keeps 1 of its 4. B is not touched.
    expect(change.sales.map((item) => item.allocations.map((allocation) => allocation.rooms))).toEqual([
      [6],
      [1],
    ]);
    expect(change.changedSales.map((item) => item.id)).toEqual(['2']);
    expect(
      change.sales.flatMap((item) => item.allocations).some((allocation) => allocation.purchaseId === 'B'),
    ).toBe(false);
  });
});

describe('affectedLines', () => {
  it('finds lines with rooms from the purchase on or after the effective date', () => {
    const before = {
      ...sale('2', 3, 'A'),
      allocations: [{ purchaseId: 'A', checkIn: '2027-05-01', checkOut: '2027-05-05', rooms: 3 }],
    };

    const affected = affectedLines({ sales: [sale('1', 6, 'A'), before] }, 'A', EFFECTIVE);

    expect(affected).toEqual([
      { sale: sale('1', 6, 'A'), lost: [{ checkIn: EFFECTIVE, checkOut: '2027-05-09', rooms: 6 }] },
    ]);
  });
});

describe('applyTermination', () => {
  const sources = { purchases: [A, purchase('B', 10)], sales: [sale('1', 6, 'A')] };

  it('keeps the purchase only before the effective date', () => {
    const result = applyTermination(sources, A, EFFECTIVE, {});

    expect(result.purchases.find((item) => item.id === 'A')?.checkOut).toBe(EFFECTIVE);
  });

  it('counts a line with no decision as accepted, and its released nights as unallocated', () => {
    const result = applyTermination(sources, A, EFFECTIVE, {});

    expect(result.accepted.map((item) => item.id)).toEqual(['1']);
    expect(result.uncovered.get('1')).toEqual([{ checkIn: EFFECTIVE, checkOut: '2027-05-09', rooms: 6 }]);
  });

  it('cancels a line', () => {
    const result = applyTermination(sources, A, EFFECTIVE, {
      '1': { kind: 'cancel', reason: 'Agent agreed' },
    });

    expect(result.cancelled.map((item) => item.id)).toEqual(['1']);
    expect(result.sales).toEqual([]);
  });

  it('re-sources the released nights from another vendor of the same type', () => {
    const result = applyTermination(sources, A, EFFECTIVE, {
      '1': { kind: 'resource', sourceTypeId: 'double' },
    });

    expect(result.resourced[0]?.allocations).toEqual([
      { purchaseId: 'A', checkIn: '2027-05-01', checkOut: EFFECTIVE, rooms: 6 },
      { purchaseId: 'B', checkIn: EFFECTIVE, checkOut: '2027-05-09', rooms: 6 },
    ]);
    expect(result.uncovered.get('1')).toEqual([]);
  });

  it('moves a line wholly to another room type', () => {
    const withQuad = { ...sources, purchases: [A, purchase('Q', 10, 'quad')] };

    const result = applyTermination(withQuad, A, EFFECTIVE, {
      '1': { kind: 'resource', sourceTypeId: 'quad' },
    });

    expect(result.resourced[0]).toMatchObject({
      roomTypeId: 'quad',
      allocations: [{ purchaseId: 'Q', checkIn: '2027-05-01', checkOut: '2027-05-09', rooms: 6 }],
    });
  });

  it('never gives two lines the same free rooms', () => {
    const tight = {
      purchases: [A, purchase('B', 5)],
      sales: [sale('1', 4, 'A'), { ...sale('2', 4, 'A'), contractId: 'contract-2' }],
    };

    const result = applyTermination(tight, A, EFFECTIVE, {
      '1': { kind: 'resource', sourceTypeId: 'double' },
      '2': { kind: 'resource', sourceTypeId: 'double' },
    });

    const fromB = result.resourced
      .flatMap((item) => item.allocations)
      .filter((allocation) => allocation.purchaseId === 'B');
    expect(fromB.reduce((total, allocation) => total + allocation.rooms, 0)).toBe(5);
    expect(result.uncovered.get('2')).toEqual([{ checkIn: EFFECTIVE, checkOut: '2027-05-09', rooms: 3 }]);
  });
});
