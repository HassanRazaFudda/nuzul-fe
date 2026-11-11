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
  if (rows.length === 0) return <p className="text-muted px-4 py-10 text-center text-sm">{empty}</p>;

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-muted text-xs">
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={cn(
                  'border-border bg-surface-raised h-8 border-b px-3 font-medium whitespace-nowrap first:sticky first:left-0 first:z-[1] first:ps-4 last:pe-4',
                  align(column),
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="text-foreground hover:bg-surface-raised group/row [&:last-child>td]:border-b-0"
            >
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={cn(
                    'border-border-subtle group-hover/row:bg-surface-raised first:bg-surface border-b px-3 py-2 whitespace-nowrap first:sticky first:left-0 first:z-[1] first:ps-4 first:font-medium last:pe-4',
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
            <tr className="text-foreground font-semibold">
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={cn(
                    'border-border bg-surface-raised border-t px-3 py-2.5 whitespace-nowrap first:sticky first:left-0 first:ps-4 last:pe-4',
                    align(column),
                  )}
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
