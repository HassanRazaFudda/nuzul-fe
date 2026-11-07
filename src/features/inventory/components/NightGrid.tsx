import { createColumnHelper } from '@tanstack/react-table';

import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { DataTable } from '@/components/data-table/DataTable';
import { EmptyState } from '@/components/feedback/EmptyState';
import type { CalendarMonth } from '@/features/calendar';

import { nightState, type LedgerNightRow } from '../domain/ledger-engine';
import { DayCell } from './DayCell';
import { InventoryStateTag } from './InventoryStateTag';

const columnHelper = createColumnHelper<ServerTableFeatures, LedgerNightRow>();

const figure = (label: string, key: 'purchased' | 'sold' | 'available') =>
  columnHelper.accessor(key, {
    enableSorting: false,
    header: () => <span className="block text-end">{label}</span>,
    cell: (info) => <span className="block text-end tabular-nums">{info.getValue()}</span>,
  });

function nightColumns(months: CalendarMonth[]) {
  return columnHelper.columns([
    columnHelper.accessor('from', {
      enableSorting: false,
      header: 'From night',
      cell: (info) => <DayCell day={info.getValue()} months={months} />,
    }),
    columnHelper.accessor('to', {
      enableSorting: false,
      header: 'Until (check-out)',
      cell: (info) => <DayCell day={info.getValue()} months={months} />,
    }),
    figure('Purchased', 'purchased'),
    figure('Sold', 'sold'),
    figure('Available', 'available'),
    columnHelper.display({
      id: 'state',
      header: 'State',
      cell: (info) => {
        const { available } = info.row.original;
        return <InventoryStateTag state={nightState(available)} rooms={Math.abs(available)} />;
      },
    }),
  ]);
}

interface NightGridProps {
  nights: LedgerNightRow[];
  months: CalendarMonth[];
}

export function NightGrid({ nights, months }: NightGridProps) {
  return (
    <DataTable
      caption="Night by night"
      columns={nightColumns(months)}
      data={nights}
      getRowId={(row) => String(row.from)}
      sort={undefined}
      onSortChange={() => undefined}
      emptyState={<EmptyState title="No nights" />}
    />
  );
}
