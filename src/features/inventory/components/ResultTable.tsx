import { createColumnHelper } from '@tanstack/react-table';

import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { DataTable } from '@/components/data-table/DataTable';
import { EmptyState } from '@/components/feedback/EmptyState';
import type { CalendarMonth } from '@/features/calendar';

import type { LedgerResultRow } from '../domain/ledger-engine';
import { DayCell } from './DayCell';

const columnHelper = createColumnHelper<ServerTableFeatures, LedgerResultRow>();

const figure = (label: string, key: 'purchased' | 'sold' | 'available') =>
  columnHelper.accessor(key, {
    enableSorting: false,
    header: () => <span className="block text-end">{label}</span>,
    cell: (info) => <span className="block text-end tabular-nums">{info.getValue()}</span>,
  });

function resultColumns(months: CalendarMonth[]) {
  return columnHelper.columns([
    columnHelper.accessor('from', {
      enableSorting: false,
      header: 'From',
      cell: (info) => <DayCell day={info.getValue()} months={months} />,
    }),
    columnHelper.accessor('to', {
      enableSorting: false,
      header: 'To',
      cell: (info) => <DayCell day={info.getValue()} months={months} />,
    }),
    figure('Purchased', 'purchased'),
    figure('Sold', 'sold'),
    figure('Available', 'available'),
  ]);
}

interface ResultTableProps {
  rows: LedgerResultRow[];
  months: CalendarMonth[];
}

export function ResultTable({ rows, months }: ResultTableProps) {
  return (
    <DataTable
      caption="Result by date range"
      columns={resultColumns(months)}
      data={rows}
      getRowId={(row) => `${String(row.from)}-${String(row.to)}`}
      sort={undefined}
      onSortChange={() => undefined}
      emptyState={<EmptyState title="No ranges" />}
    />
  );
}
