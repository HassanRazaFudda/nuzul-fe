import { describe, expect, it } from 'vitest';

import { poolLedger, buildPools } from '@/features/inventory';
import { moneyLine } from '@/lib/money/money';
import seed from '@/mock-api/seed/contracts.json';

import { contractSchema } from '../api/contract.schemas';
import {
  allocationProblems,
  suggestAllocation,
  trimToFree,
  unallocatedBlocks,
  type Supply,
} from '@/features/inventory';
import { contractTotals, lineRate, type TotalsEntry } from './contract-totals';
import { lineTags, overbookingPreview } from './overbooking';

const DOUBLE = 2;
const TRIPLE = 3;
const QUAD = 4;

const occupancy = { rateType: 'occupancy', doubleRate: '500', extraBedRate: '50', flatRate: '' } as const;

const entry = (overrides: Partial<TotalsEntry> = {}): TotalsEntry => ({
  ...occupancy,
  checkIn: '2027-05-01',
  checkOut: '2027-05-04',
  perNight: true,
  noMeals: false,
  lines: [{ capacity: DOUBLE, rooms: 2, personsPerRoom: 2 }],
  ...overrides,
});

describe('lineRate', () => {
  it('adds an extra bed per guest above two', () => {
    expect(lineRate(occupancy, DOUBLE)).toBe('500');
    expect(lineRate(occupancy, TRIPLE)).toBe('550');
    expect(lineRate(occupancy, QUAD)).toBe('600');
  });

  it('uses one rate for every room when flat', () => {
    const flat = { ...occupancy, rateType: 'flat', flatRate: '700' } as const;
    expect(lineRate(flat, DOUBLE)).toBe('700');
    expect(lineRate(flat, QUAD)).toBe('700');
  });
});

describe('contractTotals', () => {
  it('multiplies by nights only when the rate is per night', () => {
    expect(contractTotals([entry()], null, 2).roomAmount).toBe('3000.00');
    expect(contractTotals([entry({ perNight: false })], null, 2).roomAmount).toBe('1000.00');
  });

  it('counts meals by persons and nights, even on a whole-stay room rate', () => {
    // 2 rooms x 2 persons x 3 nights x 75
    expect(contractTotals([entry()], '75', 2).mealIncome).toBe('900.00');
    expect(contractTotals([entry({ perNight: false })], '75', 2).mealIncome).toBe('900.00');
  });

  it('leaves out a hotel that opted out of meals, and only that hotel', () => {
    const totals = contractTotals([entry(), entry({ noMeals: true })], '75', 2);

    expect(totals.hotels.map((hotel) => hotel.mealIncome)).toEqual(['900.00', '0.00']);
    expect(totals.mealIncome).toBe('900.00');
  });

  it('adds hotels into the grand total, without float drift', () => {
    const cents = (rate: string) =>
      entry({
        doubleRate: rate,
        lines: [{ capacity: DOUBLE, rooms: 1, personsPerRoom: 2 }],
        perNight: false,
      });

    expect(contractTotals([cents('0.1'), cents('0.2')], null, 2).total).toBe('0.30');
  });
});

const supply = (purchaseId: string, checkIn: string, checkOut: string, rooms = 10): Supply => ({
  purchaseId,
  number: purchaseId,
  vendorName: `Vendor ${purchaseId}`,
  hotelId: 'hotel',
  roomTypeId: 'double',
  checkIn,
  checkOut,
  rooms,
});

// A has nights 1-4, B has nights 3-6: the docs' worked example.
const A = supply('A', '2027-05-01', '2027-05-05');
const B = supply('B', '2027-05-03', '2027-05-07');
const LINE = {
  hotelId: 'hotel',
  roomTypeId: 'double',
  checkIn: '2027-05-01',
  checkOut: '2027-05-07',
  rooms: 6,
};

describe('suggestAllocation', () => {
  it('takes the oldest purchase first, then the next (the docs example)', () => {
    expect(suggestAllocation(LINE, [B, A], [])).toEqual([
      { purchaseId: 'A', checkIn: '2027-05-01', checkOut: '2027-05-05', rooms: 6 },
      { purchaseId: 'B', checkIn: '2027-05-05', checkOut: '2027-05-07', rooms: 6 },
    ]);
  });

  it('never exceeds free rooms, and leaves the rest unallocated', () => {
    const taken = [
      { purchaseId: 'A', roomTypeId: 'double', checkIn: '2027-05-01', checkOut: '2027-05-05', rooms: 8 },
    ];
    const allocations = suggestAllocation({ ...LINE, checkOut: '2027-05-03' }, [A], taken);

    expect(allocations).toEqual([
      { purchaseId: 'A', checkIn: '2027-05-01', checkOut: '2027-05-03', rooms: 2 },
    ]);
    expect(unallocatedBlocks({ checkIn: '2027-05-01', checkOut: '2027-05-03' }, 6, allocations)).toEqual([
      { checkIn: '2027-05-01', checkOut: '2027-05-03', rooms: 4 },
    ]);
  });

  it('ignores other hotels and room types', () => {
    expect(
      suggestAllocation(
        LINE,
        [
          { ...A, roomTypeId: 'quad' },
          { ...B, hotelId: 'other' },
        ],
        [],
      ),
    ).toEqual([]);
  });
});

describe('allocationProblems', () => {
  const row = { purchaseId: 'A', checkIn: '2027-05-01', checkOut: '2027-05-05', rooms: 6 };

  it('accepts what fits', () => {
    expect(allocationProblems(LINE, [row], [A, B], [])).toEqual([]);
  });

  it('refuses more than is free', () => {
    const taken = [{ ...row, rooms: 8, roomTypeId: 'double' }];

    expect(allocationProblems(LINE, [row], [A], taken)[0]).toMatchObject({
      field: 'rooms',
      message: 'Only 2 free on these nights',
    });
  });

  it('refuses a block outside the stay or the purchase, or above the line', () => {
    const stay = { ...LINE, checkIn: '2027-05-02' };
    expect(allocationProblems(stay, [row], [A], [])[0]?.message).toBe('Outside this stay');
    expect(allocationProblems(LINE, [{ ...row, checkOut: '2027-05-06' }], [A], [])[0]?.message).toBe(
      'Outside this purchase',
    );
    expect(allocationProblems(LINE, [{ ...row, rooms: 7 }], [A], [])[0]?.message).toBe(
      "More than the line's 6 rooms",
    );
  });

  it('refuses a purchase of another room type', () => {
    expect(allocationProblems(LINE, [row], [{ ...A, roomTypeId: 'quad' }], [])[0]?.field).toBe('purchaseId');
  });
});

describe('trimToFree', () => {
  it('cuts back to what is free, and says by how much', () => {
    const taken = [
      { purchaseId: 'A', roomTypeId: 'double', checkIn: '2027-05-03', checkOut: '2027-05-05', rooms: 7 },
    ];

    const result = trimToFree(
      [{ purchaseId: 'A', checkIn: '2027-05-01', checkOut: '2027-05-05', rooms: 6 }],
      'double',
      [A],
      taken,
    );

    expect(result.trimmedRooms).toBe(3);
    expect(result.allocations).toEqual([
      { purchaseId: 'A', checkIn: '2027-05-01', checkOut: '2027-05-03', rooms: 6 },
      { purchaseId: 'A', checkIn: '2027-05-03', checkOut: '2027-05-05', rooms: 3 },
    ]);
  });
});

// The docs' conversion example for one night: Quad 10, Triple 6, Double 4.
const night = { checkIn: '2027-05-01', checkOut: '2027-05-02' };
const purchases = [
  {
    id: 'p',
    number: 'p',
    hotelId: 'hotel',
    ...night,
    lines: [
      { roomTypeId: 'quad', rooms: 10 },
      { roomTypeId: 'triple', rooms: 6 },
      { roomTypeId: 'double', rooms: 4 },
    ],
  },
];
const types = [
  { id: 'double', name: 'Double', capacity: DOUBLE },
  { id: 'triple', name: 'Triple', capacity: TRIPLE },
  { id: 'quad', name: 'Quad', capacity: QUAD },
];
const allowed = (sourceTypeId: string, soldAsTypeId: string) => ({
  id: `all:${sourceTypeId}:${soldAsTypeId}`,
  hotelId: null,
  sourceTypeId,
  soldAsTypeId,
  allowed: true,
});
const rules = [allowed('quad', 'triple'), allowed('quad', 'double'), allowed('triple', 'double')];
const draft = (soldAsTypeId: string, sourceTypeId: string, rooms: number) => ({
  hotelId: 'hotel',
  soldAsTypeId,
  sourceTypeId,
  ...night,
  rooms,
});
const docsLines = [
  draft('quad', 'quad', 6),
  draft('triple', 'quad', 2),
  draft('double', 'quad', 2),
  draft('triple', 'triple', 5),
  draft('double', 'double', 4),
];

describe('overbookingPreview', () => {
  const context = { purchases, sales: [], rules, roomTypes: types };

  it('finds no shortage in the docs table, which ends Quad 0, Triple 1, Double 0', () => {
    expect(overbookingPreview(docsLines, context)).toEqual({ shortages: [], suggestions: [] });
  });

  it('reports one more Double from Quad, and suggests Triple, which has a free room', () => {
    const preview = overbookingPreview([...docsLines, draft('double', 'quad', 1)], context);

    expect(preview.shortages).toMatchObject([{ hotelId: 'hotel', roomTypeId: 'quad', rooms: 1 }]);
    expect(preview.suggestions).toContainEqual({
      hotelId: 'hotel',
      soldAsTypeId: 'double',
      sourceTypeId: 'triple',
      free: 1,
    });
  });

  it('does not suggest a source the rules do not allow', () => {
    const preview = overbookingPreview([...docsLines, draft('double', 'quad', 1)], {
      ...context,
      rules: [allowed('quad', 'triple'), allowed('quad', 'double')],
    });

    expect(preview.suggestions).not.toContainEqual(
      expect.objectContaining({ soldAsTypeId: 'double', sourceTypeId: 'triple' }),
    );
  });

  it('does not report a shortage on nights this contract does not touch', () => {
    const later = { checkIn: '2027-05-05', checkOut: '2027-05-06' };
    const sales = [
      {
        id: 's',
        contractId: 'c',
        reference: 'c',
        hotelId: 'hotel',
        roomTypeId: 'double',
        ...night,
        rooms: 99,
      },
    ];
    const longPurchase = [{ ...purchases[0], checkOut: '2027-05-09' }] as typeof purchases;
    const preview = overbookingPreview([{ ...draft('double', 'double', 1), ...later }], {
      ...context,
      purchases: longPurchase,
      sales,
    });

    expect(preview.shortages).toEqual([]);
  });
});

describe('lineTags', () => {
  const stay = { checkIn: '2027-05-01', checkOut: '2027-05-03' };
  const purchase = (rooms: number) => ({
    id: 'A',
    number: 'A',
    hotelId: 'hotel',
    ...stay,
    lines: [{ roomTypeId: 'double', rooms }],
  });
  const sale = (rooms: number) => ({
    id: 's',
    contractId: 'c',
    reference: 'c',
    hotelId: 'hotel',
    roomTypeId: 'double',
    ...stay,
    rooms,
  });
  const ledgerFor = (purchased: number, sold: number) => {
    const [pool] = buildPools([purchase(purchased)], [sale(sold)]);
    return pool ? poolLedger(pool) : null;
  };
  const line = (rooms: number, allocated: number) => ({
    hotelId: 'hotel',
    sourceTypeId: 'double',
    ...stay,
    rooms,
    allocations: allocated > 0 ? [{ purchaseId: 'A', ...stay, rooms: allocated }] : [],
  });
  const supplyOf = (rooms: number) => supply('A', stay.checkIn, stay.checkOut, rooms);
  const taken = (rooms: number) => [{ purchaseId: 'A', roomTypeId: 'double', ...stay, rooms }];

  it('is OVERBOOKED when the pool itself is short, and needs no vendor when none is free', () => {
    expect(lineTags(line(6, 5), ledgerFor(5, 6), [supplyOf(5)], taken(5))).toEqual({
      overbooked: true,
      needsVendor: false,
    });
  });

  it('Needs vendor when rooms have no vendor and a purchase has free rooms', () => {
    expect(lineTags(line(6, 0), ledgerFor(10, 6), [supplyOf(10)], [])).toEqual({
      overbooked: false,
      needsVendor: true,
    });
  });

  it('clears both once bought and allocated', () => {
    expect(lineTags(line(6, 6), ledgerFor(10, 6), [supplyOf(10)], taken(6))).toEqual({
      overbooked: false,
      needsVendor: false,
    });
  });
});

describe('the sample contracts', () => {
  const capacity: Record<string, number> = { double: DOUBLE, triple: TRIPLE, quad: QUAD };

  it.each(seed.map((record) => [record.number, record] as const))(
    '%s has correct frozen figures',
    (_, record) => {
      const contract = contractSchema.parse(record);
      const totals = contractTotals(
        contract.hotels.map((hotel) => ({
          ...hotel,
          lines: hotel.lines.map((item) => ({ ...item, capacity: capacity[item.soldAsTypeId] ?? 0 })),
        })),
        contract.mealPlan.kind === 'none' ? null : contract.mealPlan.rate,
        2,
      );
      const frozen = (amount: string) => moneyLine(amount, contract.currencyCode, contract.rateToPkr);

      expect(contract.total).toEqual(frozen(totals.total));
      expect(contract.roomAmount).toEqual(frozen(totals.roomAmount));
      expect(contract.mealIncome).toEqual(frozen(totals.mealIncome));
      contract.hotels.forEach((hotel, h) => {
        expect(hotel.total).toEqual(frozen(totals.hotels[h]?.total ?? ''));
        hotel.lines.forEach((item, l) => {
          expect(item.rate).toBe(totals.hotels[h]?.lines[l]?.rate);
          expect(item.roomAmount).toEqual(frozen(totals.hotels[h]?.lines[l]?.roomAmount ?? ''));
          expect(item.mealIncome).toEqual(frozen(totals.hotels[h]?.lines[l]?.mealIncome ?? ''));
        });
      });
    },
  );
});
