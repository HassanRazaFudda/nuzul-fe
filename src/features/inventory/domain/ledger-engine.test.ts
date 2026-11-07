import { describe, expect, it } from 'vitest';

import { computeLedger, nightState, worstShortage, type LedgerEntry } from './ledger-engine';

/**
 * The 12 scenarios from Invoices/inventory-ledger-check.html, unchanged. The first
 * four are the SRS worked examples. If any of these fails, the client-validated
 * behaviour has changed.
 */
type Pair = [string, number];
interface LedgerCase {
  id: number;
  title: string;
  purchases: Pair[];
  sales: Pair[];
  nights?: [string, number, number, number][];
  result?: [string, number, number, number][];
  need?: [string, number][];
}

const CASE4_SALES: Pair[] = [
  ['25 ZQ → 5 ZH', 99],
  ['25 ZQ → 1 ZH', 24],
  ['27 ZQ → 1 ZH', 11],
  ['1 ZH → 5 ZH', 108],
  ['4 ZH → 6 ZH', 17],
];

const CASES: LedgerCase[] = [
  {
    id: 1,
    title: 'One purchase, three overlaps',
    purchases: [['25 ZQ → 4 ZH', 125]],
    sales: [
      ['25 ZQ → 4 ZH', 20],
      ['25 ZQ → 1 ZH', 16],
      ['1 ZH → 4 ZH', 121],
    ],
    nights: [
      ['25 ZQ → 1 ZH', 125, 36, 89],
      ['1 ZH → 4 ZH', 125, 141, -16],
    ],
    result: [
      ['25 ZQ → 4 ZH', 125, 20, 0],
      ['25 ZQ → 1 ZH', 0, 16, 89],
      ['1 ZH → 4 ZH', 0, 121, -16],
    ],
    need: [['1 ZH → 4 ZH', 16]],
  },
  {
    id: 2,
    title: 'Purchase added after sales',
    purchases: [
      ['4 ZH → 14 ZH', 100],
      ['4 ZH → 8 ZH', 65],
      ['4 ZH → 8 ZH', 50],
    ],
    sales: [
      ['4 ZH → 14 ZH', 15],
      ['8 ZH → 14 ZH', 70],
      ['6 ZH → 14 ZH', 15],
      ['4 ZH → 8 ZH', 135],
      ['4 ZH → 6 ZH', 58],
      ['6 ZH → 8 ZH', 16],
    ],
    nights: [
      ['4 ZH → 6 ZH', 215, 208, 7],
      ['6 ZH → 8 ZH', 215, 181, 34],
      ['8 ZH → 14 ZH', 100, 100, 0],
    ],
    result: [
      ['4 ZH → 14 ZH', 100, 15, 0],
      ['4 ZH → 8 ZH', 115, 135, 7],
      ['4 ZH → 6 ZH', 0, 58, 0],
      ['6 ZH → 14 ZH', 0, 15, 0],
      ['6 ZH → 8 ZH', 0, 16, 27],
      ['8 ZH → 14 ZH', 0, 70, 0],
    ],
    need: [],
  },
  {
    id: 3,
    title: 'Genuine overbooking',
    purchases: [['14 ZH → 20 ZH', 100]],
    sales: [
      ['14 ZH → 20 ZH', 93],
      ['14 ZH → 17 ZH', 22],
      ['17 ZH → 20 ZH', 4],
    ],
    nights: [
      ['14 ZH → 17 ZH', 100, 115, -15],
      ['17 ZH → 20 ZH', 100, 97, 3],
    ],
    result: [
      ['14 ZH → 20 ZH', 100, 93, 0],
      ['14 ZH → 17 ZH', 0, 22, -15],
      ['17 ZH → 20 ZH', 0, 4, 3],
    ],
    need: [['14 ZH → 17 ZH', 15]],
  },
  {
    id: 4,
    title: 'Overbooked on an unpurchased night',
    purchases: [['25 ZQ → 5 ZH', 406]],
    sales: CASE4_SALES,
    nights: [
      ['25 ZQ → 27 ZQ', 406, 123, 283],
      ['27 ZQ → 1 ZH', 406, 134, 272],
      ['1 ZH → 4 ZH', 406, 207, 199],
      ['4 ZH → 5 ZH', 406, 224, 182],
      ['5 ZH → 6 ZH', 0, 17, -17],
    ],
    result: [
      ['25 ZQ → 5 ZH', 406, 99, 182],
      ['25 ZQ → 4 ZH', 0, 0, 17],
      ['25 ZQ → 1 ZH', 0, 24, 73],
      ['25 ZQ → 27 ZQ', 0, 0, 11],
      ['27 ZQ → 1 ZH', 0, 11, 0],
      ['1 ZH → 5 ZH', 0, 108, 0],
      ['4 ZH → 6 ZH', 0, 17, -17],
    ],
    need: [['5 ZH → 6 ZH', 17]],
  },
  {
    id: 5,
    title: 'Unsold nights in the middle',
    purchases: [['1 ZH → 10 ZH', 50]],
    sales: [
      ['1 ZH → 4 ZH', 20],
      ['8 ZH → 10 ZH', 15],
    ],
    nights: [
      ['1 ZH → 4 ZH', 50, 20, 30],
      ['4 ZH → 8 ZH', 50, 0, 50],
      ['8 ZH → 10 ZH', 50, 15, 35],
    ],
    result: [
      ['1 ZH → 10 ZH', 50, 0, 30],
      ['1 ZH → 4 ZH', 0, 20, 0],
      ['4 ZH → 10 ZH', 0, 0, 5],
      ['4 ZH → 8 ZH', 0, 0, 15],
      ['8 ZH → 10 ZH', 0, 15, 0],
    ],
    need: [],
  },
  {
    id: 6,
    title: 'Purchases only, no sales',
    purchases: [
      ['1 ZH → 8 ZH', 20],
      ['4 ZH → 6 ZH', 10],
    ],
    sales: [],
    nights: [
      ['1 ZH → 4 ZH', 20, 0, 20],
      ['4 ZH → 6 ZH', 30, 0, 30],
      ['6 ZH → 8 ZH', 20, 0, 20],
    ],
    result: [
      ['1 ZH → 8 ZH', 20, 0, 20],
      ['4 ZH → 6 ZH', 10, 0, 10],
    ],
    need: [],
  },
  {
    id: 7,
    title: 'Small purchase on one nested sale',
    purchases: [['27 ZQ → 1 ZH', 11]],
    sales: CASE4_SALES,
    result: [
      ['25 ZQ → 5 ZH', 0, 99, -99],
      ['25 ZQ → 1 ZH', 0, 24, -24],
      ['27 ZQ → 1 ZH', 11, 11, 0],
      ['1 ZH → 5 ZH', 0, 108, -108],
      ['4 ZH → 6 ZH', 0, 17, -17],
    ],
    need: [
      ['25 ZQ → 5 ZH', 123],
      ['1 ZH → 5 ZH', 84],
      ['4 ZH → 6 ZH', 17],
    ],
  },
  {
    id: 8,
    title: 'Purchase short of its sales',
    purchases: [['25 ZQ → 5 ZH', 123]],
    sales: CASE4_SALES,
    result: [
      ['25 ZQ → 5 ZH', 123, 99, 0],
      ['25 ZQ → 1 ZH', 0, 24, 0],
      ['27 ZQ → 1 ZH', 0, 11, -11],
      ['1 ZH → 5 ZH', 0, 108, -84],
      ['4 ZH → 6 ZH', 0, 17, -17],
    ],
    need: [
      ['27 ZQ → 5 ZH', 11],
      ['1 ZH → 5 ZH', 73],
      ['4 ZH → 6 ZH', 17],
    ],
  },
  {
    id: 9,
    title: 'Purchase narrower than the sales',
    purchases: [['27 ZQ → 5 ZH', 11]],
    sales: CASE4_SALES,
    result: [
      ['25 ZQ → 5 ZH', 0, 99, -99],
      ['25 ZQ → 1 ZH', 0, 24, -24],
      ['27 ZQ → 5 ZH', 11, 0, 0],
      ['27 ZQ → 1 ZH', 0, 11, 0],
      ['1 ZH → 5 ZH', 0, 108, -97],
      ['4 ZH → 6 ZH', 0, 17, -17],
    ],
    need: [
      ['25 ZQ → 5 ZH', 123],
      ['1 ZH → 5 ZH', 73],
      ['4 ZH → 6 ZH', 17],
    ],
  },
  {
    id: 10,
    title: 'Purchase only on the spill-over sale',
    purchases: [['4 ZH → 6 ZH', 17]],
    sales: CASE4_SALES,
    result: [
      ['25 ZQ → 5 ZH', 0, 99, -99],
      ['25 ZQ → 1 ZH', 0, 24, -24],
      ['27 ZQ → 1 ZH', 0, 11, -11],
      ['1 ZH → 5 ZH', 0, 108, -108],
      ['4 ZH → 6 ZH', 17, 17, 0],
    ],
    need: [
      ['25 ZQ → 5 ZH', 123],
      ['27 ZQ → 5 ZH', 11],
      ['1 ZH → 5 ZH', 73],
    ],
  },
  {
    id: 11,
    title: 'Second purchase inside the first',
    purchases: [
      ['25 ZQ → 4 ZH', 36],
      ['1 ZH → 4 ZH', 105],
    ],
    sales: [
      ['25 ZQ → 4 ZH', 20],
      ['25 ZQ → 1 ZH', 16],
      ['1 ZH → 4 ZH', 121],
    ],
    result: [
      ['25 ZQ → 4 ZH', 36, 20, 0],
      ['25 ZQ → 1 ZH', 0, 16, 0],
      ['1 ZH → 4 ZH', 105, 121, 0],
    ],
    need: [],
  },
  {
    id: 12,
    title: 'Second purchase runs past the first',
    purchases: [
      ['25 ZQ → 4 ZH', 36],
      ['1 ZH → 5 ZH', 105],
    ],
    sales: [
      ['25 ZQ → 4 ZH', 20],
      ['25 ZQ → 1 ZH', 16],
      ['1 ZH → 4 ZH', 121],
    ],
    result: [
      ['25 ZQ → 4 ZH', 36, 20, 0],
      ['25 ZQ → 1 ZH', 0, 16, 0],
      ['1 ZH → 5 ZH', 105, 0, 0],
      ['1 ZH → 4 ZH', 0, 121, 0],
      ['4 ZH → 5 ZH', 0, 0, 105],
    ],
    need: [],
  },
];

// Zul-Qadah has 30 days in these scenarios: ZQ day d → d, ZH day d → 30 + d.
function range(text: string) {
  const m = /^(\d+) (ZQ|ZH) → (\d+) (ZQ|ZH)$/.exec(text);
  if (!m) throw new Error(`Bad range: ${text}`);
  const index = (day: string | undefined, month: string | undefined) =>
    month === 'ZQ' ? Number(day) : 30 + Number(day);
  return { from: index(m[1], m[2]), to: index(m[3], m[4]) };
}
const entries = (pairs: Pair[]): LedgerEntry[] => pairs.map(([text, rooms]) => ({ ...range(text), rooms }));
function ledger(purchases: LedgerEntry[], sales: LedgerEntry[]) {
  const out = computeLedger({ purchases, sales });
  if (!out) throw new Error('Expected a ledger');
  return out;
}
const bySpan = <T extends { from: number; to: number }>(rows: T[]) =>
  [...rows].sort((a, b) => a.from - b.from || a.to - b.to);

describe('client-validated scenarios', () => {
  it.each(CASES)('Case $id: $title', (c) => {
    const out = ledger(entries(c.purchases), entries(c.sales));
    if (c.nights) {
      expect(out.nights).toEqual(
        c.nights.map(([text, purchased, sold, available]) => ({
          ...range(text),
          purchased,
          sold,
          available,
        })),
      );
    }
    if (c.result) {
      expect(bySpan(out.result)).toEqual(
        bySpan(
          c.result.map(([text, purchased, sold, available]) => ({
            ...range(text),
            purchased,
            sold,
            available,
          })),
        ),
      );
    }
    if (c.need) {
      expect(bySpan(out.need)).toEqual(bySpan(c.need.map(([text, buy]) => ({ ...range(text), buy }))));
    }
  });
});

describe('invariants on random pools', () => {
  // A fixed seed, so a failure can be reproduced.
  let seed = 20261107;
  const rnd = (n: number) => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return Math.floor((seed / 4294967296) * n);
  };
  const entry = (): LedgerEntry => {
    const from = 1 + rnd(12);
    return { from, to: from + 1 + rnd(8), rooms: 1 + rnd(120) };
  };

  it('needed-to-buy always equals the nightly shortfall, and overbooking is never invented', () => {
    for (let t = 0; t < 5000; t++) {
      const purchases = Array.from({ length: 1 + rnd(3) }, entry);
      const sales = Array.from({ length: 1 + rnd(5) }, entry);
      const out = ledger(purchases, sales);

      const bought = new Map<number, number>();
      for (const n of out.need) {
        for (let d = n.from; d < n.to; d++) bought.set(d, (bought.get(d) ?? 0) + n.buy);
      }
      for (const n of out.nights) {
        for (let d = n.from; d < n.to; d++) {
          expect(bought.get(d) ?? 0).toBe(Math.max(0, -n.available));
        }
      }
      if (out.nights.every((n) => n.available >= 0)) {
        expect(out.result.every((r) => r.available >= 0)).toBe(true);
      }
    }
  });

  /**
   * Known limitation, kept on purpose: the client validated the Result table as it
   * stands. This is exactly why overbooking tags come from the night grid.
   */
  it('reads overbooking from the grid even where the Result table shows no negative row', () => {
    const out = ledger(
      [{ from: 4, to: 12, rooms: 82 }],
      [
        { from: 8, to: 14, rooms: 23 },
        { from: 5, to: 10, rooms: 10 },
        { from: 8, to: 12, rooms: 17 },
      ],
    );
    expect(out.result.some((r) => r.available < 0)).toBe(false);
    expect(worstShortage(out)).toBe(23);
    expect(out.need).toEqual([{ from: 12, to: 14, buy: 23 }]);
  });
});

describe('helpers', () => {
  it('names the three inventory states', () => {
    expect(nightState(5)).toBe('available');
    expect(nightState(0)).toBe('full');
    expect(nightState(-1)).toBe('overbooked');
  });

  it('has nothing to report for an empty pool', () => {
    expect(computeLedger({ purchases: [], sales: [] })).toBeNull();
    expect(worstShortage(null)).toBe(0);
  });
});
