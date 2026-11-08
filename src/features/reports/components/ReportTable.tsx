import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import type { WorkbookCell } from '@/lib/export/workbook';

export interface ReportColumn<TRow> {
  header: string;
  /** Figures line up on the right. */
  isNumeric?: boolean;
  cell: (row: TRow) => ReactNode;
  /** The same value, as it goes into Excel: real numbers, not formatted text. */
  value: (row: TRow) => WorkbookCell;
}

interface ReportTableProps<TRow> {
  caption: string;
  columns: readonly ReportColumn<TRow>[];
  rows: readonly TRow[];
  rowKey: (row: TRow) => string;
  /** A total row under the records. */
  footer?: TRow | undefined;
  empty: string;
}

/** One column definition drives both the table and its Excel export, so they always agree. */
export function ReportTable<TRow>({ caption, columns, rows, rowKey, footer, empty }: ReportTableProps<TRow>) {
  const align = (column: ReportColumn<TRow>) => (column.isNumeric ? 'text-end tabular-nums' : 'text-start');
  if (rows.length === 0) return <p className="text-muted px-5 py-8 text-center text-sm">{empty}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-muted text-xs">
            {columns.map((column) => (
              <th key={column.header} scope="col" className={cn('px-4 py-2 font-semibold', align(column))}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-border text-foreground border-t">
              {columns.map((column) => (
                <td key={column.header} className={cn('px-4 py-2', align(column))}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-border text-foreground border-t-2 font-semibold">
              {columns.map((column) => (
                <td key={column.header} className={cn('px-4 py-2', align(column))}>
                  {column.cell(footer)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
