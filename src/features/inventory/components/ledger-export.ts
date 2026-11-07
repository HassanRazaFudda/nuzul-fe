import { formatDay, type CalendarMonth } from '@/features/calendar';
import { formatIsoDate, isoDate } from '@/lib/format/dates';

import type { LedgerOutput } from '../domain/ledger-engine';
import { ledgerWorkbook } from '../domain/ledger-workbook';

const COLUMN_WIDTH = 28;

/** Saves the pool's ledger as an Excel file. The library loads only when this is used. */
export async function exportLedger(ledger: LedgerOutput, months: CalendarMonth[], fileName: string) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const dayLabel = (day: number) => {
    const iso = isoDate(day);
    return `${formatDay(iso, months)} (${formatIsoDate(iso)})`;
  };
  const sheets = ledgerWorkbook(ledger, dayLabel).map(({ sheet, rows }) => ({
    sheet,
    data: rows.map((row, rowIndex) =>
      row.map((value) => (rowIndex === 0 ? { value, fontWeight: 'bold' as const } : { value })),
    ),
    columns: (rows[0] ?? []).map(() => ({ width: COLUMN_WIDTH })),
  }));
  await writeExcelFile(sheets).toFile(fileName);
}
