/** What the Excel export holds, as plain rows. Pure, so it is tested without writing a file. */

import type { LedgerOutput } from './ledger-engine';
import { nightState } from './ledger-engine';

export type WorkbookCell = string | number;

export interface WorkbookSheet {
  sheet: string;
  rows: WorkbookCell[][];
}

const STATE_WORDS = { available: 'Available', full: 'Fully utilised', overbooked: 'Overbooked' };

export function ledgerWorkbook(ledger: LedgerOutput, dayLabel: (day: number) => string): WorkbookSheet[] {
  return [
    {
      sheet: 'Night grid',
      rows: [
        ['From night', 'Until (check-out)', 'Purchased', 'Sold', 'Available', 'State'],
        ...ledger.nights.map((row) => [
          dayLabel(row.from),
          dayLabel(row.to),
          row.purchased,
          row.sold,
          row.available,
          STATE_WORDS[nightState(row.available)],
        ]),
      ],
    },
    {
      sheet: 'Rooms to buy',
      rows: [
        ['From night', 'Until (check-out)', 'Rooms to buy'],
        ...ledger.need.map((row) => [dayLabel(row.from), dayLabel(row.to), row.buy]),
      ],
    },
    {
      sheet: 'Result',
      rows: [
        ['From', 'To', 'Purchased', 'Sold', 'Available'],
        ...ledger.result.map((row) => [
          dayLabel(row.from),
          dayLabel(row.to),
          row.purchased,
          row.sold,
          row.available,
        ]),
      ],
    },
  ];
}
