import { createColumnHelper } from '@tanstack/react-table';
import { Link } from 'react-router';

import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { formatDay, type CalendarMonth } from '@/features/calendar';

import type { PoolSummary } from '../api/ledger.schemas';
import { InventoryStateTag } from './InventoryStateTag';

const columnHelper = createColumnHelper<ServerTableFeatures, PoolSummary>();

const numberHeader = (label: string) => () => <span className="block text-end">{label}</span>;

export function poolColumns(months: CalendarMonth[]) {
  return columnHelper.columns([
    columnHelper.accessor('hotelName', {
      id: 'hotel',
      header: 'Hotel',
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor('roomTypeName', {
      id: 'roomType',
      header: 'Room type',
      cell: (info) => {
        const { hotelId, roomTypeId, hotelName, roomTypeName } = info.row.original;
        return (
          <Link
            to={`/inventory/${hotelId}/${roomTypeId}`}
            aria-label={`${hotelName} ${roomTypeName}`}
            className="text-primary-strong font-medium underline"
          >
            {info.getValue()}
          </Link>
        );
      },
    }),
    columnHelper.display({
      id: 'stay',
      header: 'Stay',
      cell: (info) => {
        const { firstNight, lastCheckOut } = info.row.original;
        return (
          <span className="whitespace-nowrap">
            {formatDay(firstNight, months)} to {formatDay(lastCheckOut, months)}
          </span>
        );
      },
    }),
    columnHelper.accessor('peakPurchased', {
      enableSorting: false,
      header: numberHeader('Peak purchased'),
      cell: (info) => <span className="block text-end tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.accessor('peakSold', {
      enableSorting: false,
      header: numberHeader('Peak sold'),
      cell: (info) => <span className="block text-end tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.accessor('lowestAvailable', {
      id: 'state',
      header: 'State',
      cell: (info) => {
        const { state, lowestAvailable } = info.row.original;
        return <InventoryStateTag state={state} rooms={Math.abs(lowestAvailable)} />;
      },
    }),
    columnHelper.accessor('needsBuying', {
      enableSorting: false,
      header: 'Rooms to buy',
      cell: (info) => (info.getValue() ? 'Yes' : 'No'),
    }),
  ]);
}
