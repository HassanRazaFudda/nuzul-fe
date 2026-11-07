import { describe, expect, it } from 'vitest';

import { dayNumber, isoDate } from '@/lib/format/dates';

import {
  buildPools,
  poolFigures,
  poolLedger,
  resultHidesShortage,
  roomNights,
  type PoolPurchaseInput,
  type PoolSaleInput,
} from './pools';

const START = dayNumber('2027-05-01');
const night = (offset: number) => isoDate(START + offset);

const purchase = (
  id: string,
  from: number,
  to: number,
  lines: PoolPurchaseInput['lines'],
  hotelId = 'hotel',
): PoolPurchaseInput => ({ id, number: id, hotelId, checkIn: night(from), checkOut: night(to), lines });

const sale = (id: string, from: number, to: number, rooms: number, roomTypeId = 'double'): PoolSaleInput => ({
  id,
  contractId: id,
  reference: id,
  hotelId: 'hotel',
  roomTypeId,
  checkIn: night(from),
  checkOut: night(to),
  rooms,
});

const onlyLedger = (purchases: PoolPurchaseInput[], sales: PoolSaleInput[]) => {
  const [pool] = buildPools(purchases, sales);
  if (!pool) throw new Error('expected a pool');
  const ledger = poolLedger(pool);
  if (!ledger) throw new Error('expected a ledger');
  return ledger;
};

describe('buildPools', () => {
  it('splits by hotel and by room type', () => {
    const pools = buildPools(
      [
        purchase('a', 0, 5, [
          { roomTypeId: 'double', rooms: 5 },
          { roomTypeId: 'triple', rooms: 2 },
        ]),
        purchase('b', 0, 5, [{ roomTypeId: 'double', rooms: 1 }], 'other'),
      ],
      [],
    );

    expect(pools.map((pool) => `${pool.hotelId}/${pool.roomTypeId}`)).toEqual([
      'hotel/double',
      'hotel/triple',
      'other/double',
    ]);
  });

  it('adds up several purchases on one pool', () => {
    const ledger = onlyLedger(
      [
        purchase('a', 0, 5, [{ roomTypeId: 'double', rooms: 5 }]),
        purchase('b', 0, 5, [{ roomTypeId: 'double', rooms: 3 }]),
      ],
      [],
    );

    expect(ledger.nights[0]?.available).toBe(8);
  });

  it('gives a sale with no purchase its own, fully short pool', () => {
    const ledger = onlyLedger([], [sale('s', 0, 2, 4)]);

    expect(poolFigures(ledger)).toMatchObject({ state: 'overbooked', shortage: 4, needsBuying: true });
  });
});

describe('SRS Case 1 through records', () => {
  const ledger = onlyLedger(
    [purchase('a', 0, 9, [{ roomTypeId: 'double', rooms: 125 }])],
    [sale('s1', 0, 9, 20), sale('s2', 0, 6, 16), sale('s3', 6, 9, 121)],
  );

  it('gives 89 then -16, and buy 16 for the short nights', () => {
    expect(ledger.nights.map((row) => row.available)).toEqual([89, -16]);
    expect(ledger.need).toEqual([{ from: START + 6, to: START + 9, buy: 16 }]);
  });

  it('sums up from the grid', () => {
    expect(poolFigures(ledger)).toEqual({
      firstNight: night(0),
      lastCheckOut: night(9),
      peakPurchased: 125,
      peakSold: 141,
      lowestAvailable: -16,
      state: 'overbooked',
      shortage: 16,
      needsBuying: true,
    });
    expect(roomNights(ledger, 'purchased')).toBe(1125);
    expect(roomNights(ledger, 'sold')).toBe(36 * 6 + 141 * 3);
  });
});

describe('the Result limitation', () => {
  // docs/inventory-ledger-rules.md: nights 12 to 14 are short, yet no Result row is negative.
  const ledger = onlyLedger(
    [purchase('a', 4, 12, [{ roomTypeId: 'double', rooms: 82 }])],
    [sale('s1', 8, 14, 23), sale('s2', 5, 10, 10), sale('s3', 8, 12, 17)],
  );

  it('still reads as overbooked, from the grid', () => {
    expect(poolFigures(ledger)).toMatchObject({ state: 'overbooked', shortage: 23 });
  });

  it('is detected, so the screen can warn', () => {
    expect(resultHidesShortage(ledger)).toBe(true);
  });

  it('is not raised for a shortage the Result does show', () => {
    expect(
      resultHidesShortage(
        onlyLedger([purchase('a', 0, 2, [{ roomTypeId: 'double', rooms: 1 }])], [sale('s', 0, 2, 3)]),
      ),
    ).toBe(false);
  });
});

describe('poolFigures states', () => {
  const stateOf = (rooms: number) =>
    poolFigures(
      onlyLedger([purchase('a', 0, 2, [{ roomTypeId: 'double', rooms: 5 }])], [sale('s', 0, 2, rooms)]),
    )?.state;

  it('tells available, full and overbooked apart', () => {
    expect(stateOf(4)).toBe('available');
    expect(stateOf(5)).toBe('full');
    expect(stateOf(6)).toBe('overbooked');
  });
});
