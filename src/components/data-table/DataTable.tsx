import { FlexRender, useTable, type SortingState } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { serverTableFeatures, type ServerColumnDef } from './data-table-features';

export interface DataTableSort {
  id: string;
  desc: boolean;
}

interface DataTableProps<TData extends object> {
  columns: ServerColumnDef<TData>[];
  data: TData[];
  getRowId: (row: TData) => string;
  /** Accessible name for the table, e.g. "Hotels". */
  caption: string;
  sort: DataTableSort | undefined;
  onSortChange: (sort: DataTableSort | undefined) => void;
  /** True while a new page or sort is loading and the previous rows are still shown. */
  isFetching?: boolean;
  isCompact?: boolean;
  emptyState: ReactNode;
}

/**
 * Presentational, server-driven table. It knows nothing about any record, API or the URL:
 * the feature passes data in and receives sort changes out. It scrolls sideways inside its
 * own frame on a narrow screen, never the page.
 */
export function DataTable<TData extends object>({
  columns,
  data,
  getRowId,
  caption,
  sort,
  onSortChange,
  isFetching = false,
  isCompact = false,
  emptyState,
}: DataTableProps<TData>) {
  const sorting: SortingState = sort ? [sort] : [];

  const table = useTable({
    features: serverTableFeatures,
    columns,
    data,
    getRowId,
    manualSorting: true,
    enableMultiSort: false,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      onSortChange(next[0]);
    },
  });

  const rows = table.getRowModel().rows;

  if (rows.length === 0) return <>{emptyState}</>;

  return (
    <div className="max-h-[70vh] overflow-auto">
      <table
        className={cn('w-full border-collapse text-sm', isFetching && 'opacity-60')}
        aria-busy={isFetching || undefined}
      >
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-muted sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    className="border-border text-muted border-b px-4 py-2 text-start text-xs font-semibold whitespace-nowrap"
                    aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                  >
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="hover:text-foreground inline-flex items-center gap-1"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <FlexRender header={header} />
                        {sorted === 'asc' && <ArrowUp aria-hidden className="size-3.5" />}
                        {sorted === 'desc' && <ArrowDown aria-hidden className="size-3.5" />}
                        {!sorted && <ChevronsUpDown aria-hidden className="text-faint size-3.5" />}
                      </button>
                    ) : (
                      <FlexRender header={header} />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-border hover:bg-surface-muted border-b transition-colors duration-150 last:border-b-0"
              style={{ height: isCompact ? 'var(--table-row-height-compact)' : 'var(--table-row-height)' }}
            >
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="text-foreground px-4 py-1.5">
                  <FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
