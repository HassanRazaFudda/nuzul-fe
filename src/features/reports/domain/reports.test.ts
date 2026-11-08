import { describe, expect, it } from 'vitest';

import type { Meal } from '@/features/purchases';
import { dayNumber, isoDate } from '@/lib/format/dates';

import { converter, MissingRateError, type Money } from './currency';
import { nightFacts, type PurchaseRecord, type SaleRecord } from './night-facts';
import { contractProfit, inventoryRows, profitAndLoss, salesRows, vendorMargin } from './reports';

// Night 1 of the examples.
const START = dayNumber('2027-05-01');
const night = (n: number) => isoDate(START + n - 1);
const sar = (amount: number | string): Money => ({
  amount: String(amount),
  currencyCode: 'SAR',
  rateToPkr: '70',
});
const SAR_RATES = [{ id: 'r', currencyCode: 'SAR', rateToPkr: '70', effectiveFrom: '2026-01-01' }];
const inSar = converter('transaction', 'SAR', '2027-01-01', SAR_RATES);
const ALL = { from: '', to: '' };

/** `rate` is per room-night; the line cost is rate × rooms × nights. */
function purchase(
  id: string,
  rooms: number,
  rate: number,
  firstNight: number,
  lastNight: number,
  meal: Meal = { pricing: 'none' },
): PurchaseRecord {
  const nights = lastNight - firstNight + 1;
  return {
    id,
    number: id,
    vendorId: `vendor-${id}`,
    hotelId: 'h',
    checkIn: night(firstNight),
    checkOut: night(lastNight + 1),
    boughtNights: nights,
    currencyCode: 'SAR',
    rateToPkr: '70',
    meal,
    lines: [{ roomTypeId: 'd', rooms, personsPerRoom: 2, cost: sar(rate * rooms * nights) }],
  };
}

function sale(
  id: string,
  rooms: number,
  amount: number,
  firstNight: number,
  lastNight: number,
  extra: Partial<SaleRecord> = {},
): SaleRecord {
  return {
    id,
    contractId: `c-${id}`,
    number: `CON-${id}`,
    date: '2026-11-01',
    agentId: 'agent',
    hotelId: 'h',
    soldAsTypeId: 'd',
    sourceTypeId: 'd',
    checkIn: night(firstNight),
    checkOut: night(lastNight + 1),
    rooms,
    personsPerRoom: 2,
    roomAmount: sar(amount),
    mealIncome: sar(0),
    allocations: [],
    ...extra,
  };
}

const pnl = (purchases: PurchaseRecord[], sales: SaleRecord[], convert = inSar) =>
  profitAndLoss(nightFacts(purchases, sales, convert), [], ALL, '', convert, 2);

describe('weighted average cost (§1)', () => {
  it('is total cost over purchased room-nights, never an average of rates', () => {
    const equal = nightFacts([purchase('A', 10, 100, 1, 10), purchase('B', 10, 200, 1, 10)], [], inSar);
    const shorter = nightFacts([purchase('A', 10, 100, 1, 10), purchase('B', 10, 200, 1, 5)], [], inSar);
    const average = (facts: typeof equal) => {
      const cost = facts.pools.reduce(
        (total, pool) => total + pool.averageRoomCost.times(pool.purchased).toNumber(),
        0,
      );
      const roomNights = facts.pools.reduce((total, pool) => total + pool.purchased, 0);
      return (cost / roomNights).toFixed(2);
    };

    expect(average(equal)).toBe('150.00');
    expect(average(shorter)).toBe('133.33');
  });

  it('follows each night across different stay periods: cost 4,500, exposure 7,500', () => {
    const result = pnl([purchase('A', 10, 100, 1, 4), purchase('B', 10, 200, 3, 6)], [sale('1', 5, 0, 1, 6)]);

    expect(result.total.costRoom).toBe('4500.00');
    expect(result.exposure).toBe('7500.00');
  });

  it('gives 300 profit where actual rates would give 800 or -200', () => {
    const purchases = [purchase('A', 10, 100, 1, 1), purchase('B', 10, 200, 1, 1)];
    const fromA = sale('1', 10, 1800, 1, 1, {
      allocations: [{ purchaseId: 'A', checkIn: night(1), checkOut: night(2), rooms: 10 }],
    });
    const facts = nightFacts(purchases, [fromA], inSar);

    expect(profitAndLoss(facts, [], ALL, '', inSar, 2).total.profitKnown).toBe('300.00');
    expect(profitAndLoss(facts, [], ALL, '', inSar, 2).exposure).toBe('1500.00');
    expect(vendorMargin(facts, purchases, ALL, inSar, 2)).toEqual([
      { vendorId: 'vendor-A', roomNights: '10', revenue: '1800.00', cost: '1000.00', margin: '800.00' },
    ]);
  });

  it('counts a terminated purchase only for the nights it still covers', () => {
    // As loaded, a Terminated purchase already ends at its effective date; its cost per
    // night still comes from the stay as bought.
    const cut = { ...purchase('A', 10, 100, 1, 10), checkOut: night(5) };

    const result = pnl([cut], []);

    expect(result.exposure).toBe('4000.00');
  });
});

describe('meals (§2)', () => {
  const fullCapacity: Meal = {
    pricing: 'separate',
    rate: '50',
    basis: 'perPersonPerNight',
    chargeBasis: 'fullCapacity',
  };
  const guestsSold: Meal = { ...fullCapacity, chargeBasis: 'guestsSold' };
  const threeRooms = (extra: Partial<SaleRecord> = {}) =>
    sale('1', 3, 0, 1, 3, { mealIncome: sar(0), ...extra });

  it('full capacity: 900 on sold rooms, 600 in unsold exposure', () => {
    const result = pnl([purchase('A', 5, 0, 1, 3, fullCapacity)], [threeRooms()]);

    expect(result.total.costMeal).toBe('900.00');
    expect(result.exposure).toBe('600.00');
  });

  it('guests sold: 900, following the allocated vendor, and no exposure', () => {
    const allocated = threeRooms({
      allocations: [{ purchaseId: 'A', checkIn: night(1), checkOut: night(4), rooms: 3 }],
    });

    const result = pnl([purchase('A', 5, 0, 1, 3, guestsSold)], [allocated]);

    expect(result.total.costMeal).toBe('900.00');
    expect(result.exposure).toBe('0.00');
  });

  it('shows room and meal margins apart, and flags meal income with no meal bought', () => {
    const recorded = pnl(
      [purchase('A', 1, 500, 1, 1, { ...fullCapacity, rate: '60' })],
      [sale('1', 1, 600, 1, 1, { mealIncome: sar(150) })],
    );
    const missing = pnl([purchase('A', 1, 500, 1, 1)], [sale('1', 1, 600, 1, 1, { mealIncome: sar(150) })]);

    expect(recorded.total).toMatchObject({
      roomMargin: '100.00',
      mealMargin: '30.00',
      profitKnown: '130.00',
    });
    expect(missing.total).toMatchObject({ profitKnown: '250.00', mealMissingRoomNights: '1' });
  });

  it('adds no meal cost when meals are included in the room rate, and is not flagged', () => {
    const result = pnl(
      [purchase('A', 1, 500, 1, 1, { pricing: 'included' })],
      [sale('1', 1, 600, 1, 1, { mealIncome: sar(150) })],
    );

    expect(result.total).toMatchObject({ costMeal: '0.00', mealMissingRoomNights: '0' });
  });
});

describe('overbooked rooms: cost Unknown (§3)', () => {
  it('reports 500 on the known portion, and 2 room-nights with revenue 300 as unknown', () => {
    const result = pnl([purchase('A', 10, 100, 1, 1)], [sale('1', 12, 1800, 1, 1)]);

    expect(result.isPartial).toBe(true);
    expect(result.total).toMatchObject({
      revenueRoom: '1500.00',
      costRoom: '1000.00',
      profitKnown: '500.00',
      unknownRoomNights: '2',
      unknownRevenue: '300.00',
    });
  });

  it('moves them to known once the purchase is added', () => {
    const result = pnl(
      [purchase('A', 10, 100, 1, 1), purchase('B', 2, 100, 1, 1)],
      [sale('1', 12, 1800, 1, 1)],
    );

    expect(result.isPartial).toBe(false);
    expect(result.total.profitKnown).toBe('600.00');
  });
});

describe('currency (§5)', () => {
  const rates = [
    { id: '1', currencyCode: 'SAR', rateToPkr: '70', effectiveFrom: '2026-01-01' },
    { id: '2', currencyCode: 'SAR', rateToPkr: '72', effectiveFrom: '2026-06-01' },
  ];
  const purchases = [{ ...purchase('A', 1, 1000, 1, 1) }];
  const sales = [
    sale('1', 1, 0, 1, 1, { roomAmount: { amount: '1500', currencyCode: 'SAR', rateToPkr: '72' } }),
  ];
  const profitIn = (policy: 'transaction' | 'revaluation', currency: string) => {
    const convert = converter(policy, currency, '2026-07-01', rates);
    return pnl(purchases, sales, convert).total.profitKnown;
  };

  it('transaction-date: PKR 38,000, and SAR 500 in SAR', () => {
    expect(profitIn('transaction', 'PKR')).toBe('38000.00');
    expect(profitIn('transaction', 'SAR')).toBe('500.00');
  });

  it('revaluation at 72: PKR 36,000, a 2,000 difference', () => {
    expect(profitIn('revaluation', 'PKR')).toBe('36000.00');
  });

  it('refuses a currency with no rate on the date', () => {
    expect(() => converter('transaction', 'USD', '2026-07-01', rates)).toThrow(MissingRateError);
  });
});

describe('reports that foot', () => {
  const purchases = [purchase('A', 10, 100, 1, 4), purchase('B', 10, 200, 3, 6)];
  const sales = [
    sale('1', 5, 6000, 1, 6, {
      allocations: [{ purchaseId: 'A', checkIn: night(1), checkOut: night(5), rooms: 5 }],
    }),
    sale('2', 3, 1000, 2, 3, { date: '2026-12-01' }),
  ];
  const facts = nightFacts(purchases, sales, inSar);

  it('adds contracts up to the same profit as the stay-date P&L', () => {
    const byContract = contractProfit(facts, ALL, 2);
    const total = byContract.reduce((sum, row) => sum + Number(row.profitKnown), 0);

    expect(total.toFixed(2)).toBe(profitAndLoss(facts, [], ALL, '', inSar, 2).total.profitKnown);
    expect(contractProfit(facts, { from: '2026-11-15', to: '' }, 2).map((row) => row.number)).toEqual([
      'CON-2',
    ]);
  });

  it('limits the stay-date P&L to nights in range', () => {
    const firstTwo = profitAndLoss(facts, [], { from: night(1), to: night(3) }, '', inSar, 2);

    // Night 1: 5 rooms, night 2: 8 rooms.
    expect(firstTwo.total.roomNights).toBe('13');
  });

  it('nets penalties and refunds dated in the period as their own line', () => {
    const adjustments = [
      { kind: 'penalty' as const, effectiveDate: '2027-05-03', purchaseId: 'A', amount: sar(500) },
      { kind: 'refund' as const, effectiveDate: '2027-05-03', purchaseId: 'A', amount: sar(200) },
      { kind: 'penalty' as const, effectiveDate: '2028-01-01', purchaseId: 'A', amount: sar(999) },
    ];

    expect(
      profitAndLoss(facts, adjustments, { from: '2027-05-01', to: '2027-06-01' }, '', inSar, 2).adjustments,
    ).toBe('-300.00');
  });

  it('splits sales by vendor through allocations, and the rest has no vendor', () => {
    const rows = salesRows(sales.slice(0, 1), purchases, 'vendor', inSar, 2);

    // 5 rooms × 6 nights = 30 room-nights; A supplies 20 of them.
    expect(rows).toEqual([
      { group: '', contracts: 1, hotels: 1, rooms: 5, roomNights: '10', amount: '2000.00' },
      { group: 'vendor-A', contracts: 1, hotels: 1, rooms: 5, roomNights: '20', amount: '4000.00' },
    ]);
  });

  it('lists sold and unsold rooms per pool, joining like nights', () => {
    const rows = inventoryRows(facts.pools, ALL, '', 2);

    expect(rows.map((row) => [row.checkIn, row.checkOut, row.purchased, row.sold, row.unsold])).toEqual([
      [night(1), night(2), 10, 5, 5],
      [night(2), night(3), 10, 8, 2],
      [night(3), night(4), 20, 8, 12],
      [night(4), night(5), 20, 5, 15],
      [night(5), night(7), 10, 5, 5],
    ]);
  });
});
