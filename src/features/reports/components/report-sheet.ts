import type { ReportColumn } from './ReportTable';

/** The rows as a sheet: headers, then records, then the total. */
export function toSheet<TRow>(
  sheet: string,
  columns: readonly ReportColumn<TRow>[],
  rows: readonly TRow[],
  footer?: TRow,
) {
  return {
    sheet,
    rows: [
      columns.map((column) => column.header),
      ...rows.map((row) => columns.map((column) => column.value(row))),
      ...(footer ? [columns.map((column) => column.value(footer))] : []),
    ],
  };
}
