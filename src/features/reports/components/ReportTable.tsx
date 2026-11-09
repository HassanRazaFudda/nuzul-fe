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
  if (rows.length === 0) return <p className="text-muted px-5 py-10 text-center text-sm">{empty}</p>;

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-border text-muted border-b text-xs">
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={cn('h-9 px-3 font-medium whitespace-nowrap first:ps-5 last:pe-5', align(column))}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-border text-foreground border-b last:border-b-0">
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={cn(
                    'px-3 py-2.5 whitespace-nowrap first:min-w-36 first:ps-5 first:whitespace-normal last:pe-5',
                    align(column),
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-border bg-background text-foreground border-t font-medium">
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={cn('px-3 py-2.5 whitespace-nowrap first:ps-5 last:pe-5', align(column))}
                >
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
