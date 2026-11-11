import { createColumnHelper } from '@tanstack/react-table';
import { Link } from 'react-router';

import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { formatDay, type CalendarMonth } from '@/features/calendar';

import type { PoolSummary } from '../api/ledger.schemas';
import { InventoryStateTag } from './InventoryStateTag';

const columnHelper = createColumnHelper<ServerTableFeatures, PoolSummary>();

/** Rooms on the busiest night, not room-nights: what an agent compares with a request. */
const numberHeader = (label: string) => () => (
  <span className="block text-end" title="Rooms on the busiest night">
    {label}
  </span>
);

export function poolColumns(months: CalendarMonth[]) {
  return columnHelper.columns([
    // The hotel is the group heading above its room types.
    columnHelper.accessor('roomTypeName', {
      id: 'roomType',
      header: 'Room type',
      cell: (info) => {
        const { hotelId, roomTypeId, hotelName, roomTypeName } = info.row.original;
        return (
          <Link
            to={`/inventory/${hotelId}/${roomTypeId}`}
            aria-label={`${hotelName} ${roomTypeName}`}
            className="text-foreground ps-3 font-medium"
          >
            {roomTypeName}
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
          <span className="text-secondary whitespace-nowrap">
            {formatDay(firstNight, months)} to {formatDay(lastCheckOut, months)}
          </span>
        );
      },
    }),
    columnHelper.accessor('peakPurchased', {
      enableSorting: false,
      header: numberHeader('Purchased'),
      cell: (info) => <span className="block text-end tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.accessor('peakSold', {
      enableSorting: false,
      header: numberHeader('Sold'),
      cell: (info) => <span className="block text-end tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.accessor('lowestAvailable', {
      id: 'state',
      header: 'Tightest night',
      cell: (info) => {
        const { state, lowestAvailable } = info.row.original;
        return <InventoryStateTag state={state} rooms={Math.abs(lowestAvailable)} />;
      },
    }),
  ]);
}
