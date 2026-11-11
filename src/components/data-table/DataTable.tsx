import { FlexRender, useTable, type SortingState } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Fragment, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

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
  /** Makes the whole row open this page, not only the link in its first cell. */
  getRowHref?: ((row: TData) => string) | undefined;
  /** Makes the whole row run this, such as opening an editor. */
  onRowClick?: ((row: TData) => void) | undefined;
  /**
   * Puts a heading row above each run of rows with the same key. The rows must already
   * arrive with each group together.
   */
  grouping?: TableGrouping<TData> | undefined;
}

export interface TableGrouping<TData> {
  key: (row: TData) => string;
  /** The heading, given every row of the group on this page. */
  heading: (rows: TData[]) => ReactNode;
}

const INTERACTIVE = 'a, button, input, select, textarea, label, [role="menu"], [popover]';

/**
 * Presentational, server-driven table. It knows nothing about any record, API or the URL:
 * the feature passes data in and receives sort changes out. On a wide screen the page scrolls
 * and the header sticks; on a narrow one the table scrolls sideways inside its own frame.
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
  getRowHref,
  onRowClick,
  grouping,
}: DataTableProps<TData>) {
  const navigate = useNavigate();
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
  const isClickable = Boolean(getRowHref ?? onRowClick);

  /**
   * A click anywhere on a row opens it. The row's own link or button stays the keyboard and
   * screen-reader path; clicks on a control inside the row, or that end a text selection, are
   * left alone.
   */
  function handleRowClick(event: MouseEvent<HTMLTableRowElement>, row: TData) {
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
    if (window.getSelection()?.toString()) return;
    if (onRowClick) {
      onRowClick(row);
      return;
    }
    const href = getRowHref?.(row);
    if (!href) return;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, '_blank', 'noopener');
      return;
    }
    void navigate(href);
  }

  if (rows.length === 0) return <>{emptyState}</>;

  return (
    <div className="relative overflow-x-auto lg:overflow-visible">
      <table
        className={cn('w-full border-separate border-spacing-0 text-sm', isFetching && 'opacity-60')}
        aria-busy={isFetching || undefined}
      >
        <caption className="sr-only">{caption}</caption>
        <thead className="lg:sticky lg:top-0 lg:z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    className="border-border bg-surface-raised text-muted h-8 border-b px-4 text-start text-xs font-medium whitespace-nowrap"
                    aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                  >
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="hover:text-foreground group inline-flex items-center gap-1 transition-colors duration-150"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <FlexRender header={header} />
                        {sorted === 'asc' && <ArrowUp aria-hidden className="text-foreground size-3.5" />}
                        {sorted === 'desc' && <ArrowDown aria-hidden className="text-foreground size-3.5" />}
                        {!sorted && (
                          <ChevronsUpDown
                            aria-hidden
                            className="text-faint size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        )}
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
          {rows.map((row, index) => (
            <Fragment key={row.id}>
              {grouping &&
                (index === 0 ||
                  grouping.key(row.original) !== grouping.key((rows[index - 1] ?? row).original)) && (
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={row.getAllCells().length}
                      className="border-border bg-surface-muted text-foreground text-meta h-9 border-b px-4 text-start font-semibold"
                    >
                      {grouping.heading(
                        rows
                          .filter((item) => grouping.key(item.original) === grouping.key(row.original))
                          .map((item) => item.original),
                      )}
                    </th>
                  </tr>
                )}
              <tr
                key={row.id}
                className={cn(
                  'hover:bg-surface-raised group/row transition-colors duration-100 [&:last-child>td]:border-b-0',
                  isClickable && 'cursor-pointer',
                )}
                style={{ height: isCompact ? 'var(--table-row-height-compact)' : 'var(--table-row-height)' }}
                {...(isClickable
                  ? {
                      onClick: (event: MouseEvent<HTMLTableRowElement>) => {
                        handleRowClick(event, row.original);
                      },
                    }
                  : {})}
              >
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="border-border-subtle text-foreground border-b px-4 py-1.5">
                    <FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
