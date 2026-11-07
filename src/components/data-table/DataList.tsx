import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { QueryErrorState } from '@/components/feedback/QueryErrorState';
import { TableSkeleton } from '@/components/feedback/TableSkeleton';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { ListParams, Paginated } from '@/lib/api/pagination';

import type { ServerColumnDef } from './data-table-features';
import { DataTable } from './DataTable';
import { Pagination } from './Pagination';
import { TableToolbar } from './TableToolbar';
import { useTableDensity } from './useTableDensity';

interface DataListProps<TData extends object, TSort extends string> {
  caption: string;
  columns: ServerColumnDef<TData>[];
  getRowId: (row: TData) => string;
  query: UseQueryResult<Paginated<TData>>;
  params: ListParams<TSort>;
  defaultSortBy: TSort;
  onParamsChange: (patch: Partial<ListParams<TSort>>) => void;
  isSortField: (id: string) => id is TSort;
  emptyTitle: string;
  emptyHint?: string;
  emptyAction?: ReactNode;
  toolbar?: ReactNode;
}

/** A whole list: search, the four states (loading, error, empty, data), sort and pages. */
export function DataList<TData extends object, TSort extends string>({
  caption,
  columns,
  getRowId,
  query,
  params,
  defaultSortBy,
  onParamsChange,
  isSortField,
  emptyTitle,
  emptyHint,
  emptyAction,
  toolbar,
}: DataListProps<TData, TSort>) {
  const { isCompact, setCompact } = useTableDensity();
  const { data, error, isPending, isFetching, isPlaceholderData, refetch } = query;

  function renderBody() {
    if (isPending) return <TableSkeleton rows={6} columns={columns.length} />;
    if (!data) {
      return (
        <div className="p-4">
          <QueryErrorState error={error} onRetry={() => void refetch()} />
        </div>
      );
    }
    const noMatch = (
      <EmptyState
        title={`Nothing matches “${params.search}”`}
        hint="Try a different word, or clear the search."
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onParamsChange({ search: '' });
            }}
          >
            Clear search
          </Button>
        }
      />
    );
    return (
      <>
        <DataTable
          caption={caption}
          columns={columns}
          data={data.items}
          getRowId={getRowId}
          isCompact={isCompact}
          isFetching={isFetching && isPlaceholderData}
          sort={{ id: params.sortBy, desc: params.sortDir === 'desc' }}
          onSortChange={(sort) => {
            onParamsChange(
              sort && isSortField(sort.id)
                ? { sortBy: sort.id, sortDir: sort.desc ? 'desc' : 'asc' }
                : { sortBy: defaultSortBy, sortDir: 'asc' },
            );
          }}
          emptyState={
            params.search ? (
              noMatch
            ) : (
              <EmptyState
                title={emptyTitle}
                {...(emptyHint ? { hint: emptyHint } : {})}
                action={emptyAction}
              />
            )
          }
        />
        {data.meta.totalItems > 0 && (
          <Pagination
            meta={data.meta}
            onPageChange={(page) => {
              onParamsChange({ page });
            }}
          />
        )}
      </>
    );
  }

  return (
    <Card>
      <TableToolbar
        key={params.search}
        label={caption}
        search={params.search}
        onSearch={(search) => {
          onParamsChange({ search });
        }}
        isCompact={isCompact}
        onCompactChange={setCompact}
      >
        {toolbar}
      </TableToolbar>
      {renderBody()}
    </Card>
  );
}
