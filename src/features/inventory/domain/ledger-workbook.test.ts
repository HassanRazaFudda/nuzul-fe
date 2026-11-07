import { describe, expect, it } from 'vitest';

import { computeLedger } from './ledger-engine';
import { ledgerWorkbook } from './ledger-workbook';

const ledger = computeLedger({
  purchases: [{ from: 25, to: 34, rooms: 125 }],
  sales: [
    { from: 25, to: 34, rooms: 20 },
    { from: 25, to: 31, rooms: 16 },
    { from: 31, to: 34, rooms: 121 },
  ],
});

describe('ledgerWorkbook', () => {
  if (!ledger) throw new Error('expected a ledger');
  const sheets = ledgerWorkbook(ledger, (day) => `day ${String(day)}`);

  it('holds the grid, the buy list and the Result, with real numbers', () => {
    expect(sheets.map((sheet) => sheet.sheet)).toEqual(['Night grid', 'Rooms to buy', 'Result']);
    expect(sheets[0]?.rows.slice(1)).toEqual([
      ['day 25', 'day 31', 125, 36, 89, 'Available'],
      ['day 31', 'day 34', 125, 141, -16, 'Overbooked'],
    ]);
    expect(sheets[1]?.rows[1]).toEqual(['day 31', 'day 34', 16]);
  });
});
