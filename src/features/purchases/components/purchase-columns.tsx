import { createColumnHelper } from '@tanstack/react-table';
import { Link } from 'react-router';

import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { Amount } from '@/components/ui/Amount';
import { RECORD_LINK_CLASS } from '@/components/ui/buttonStyles';
import { formatDay, type CalendarMonth } from '@/features/calendar';
import { nightsBetween } from '@/lib/format/dates';

import type { PurchaseView } from '../api/purchase.schemas';

const columnHelper = createColumnHelper<ServerTableFeatures, PurchaseView>();

interface PurchaseColumnOptions {
  months: CalendarMonth[];
  moneyFormat: (code: string) => { symbol: string; decimals: number };
}

export function purchaseColumns({ months, moneyFormat }: PurchaseColumnOptions) {
  return columnHelper.columns([
    columnHelper.accessor('number', {
      header: 'Number',
      cell: (info) => (
        <Link to={`/purchases/${info.row.original.id}`} className={RECORD_LINK_CLASS}>
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor('hotelName', {
      header: 'Hotel',
      enableSorting: false,
      cell: (info) => <span className="text-foreground font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor('vendorName', {
      id: 'vendor',
      header: 'Vendor',
      cell: (info) => <span className="text-secondary">{info.getValue()}</span>,
    }),
    columnHelper.accessor('checkIn', {
      header: 'Stay',
      cell: (info) => {
        const { checkIn, checkOut } = info.row.original;
        const nights = nightsBetween(checkIn, checkOut);
        return (
          <span className="whitespace-nowrap">
            {formatDay(checkIn, months)} to {formatDay(checkOut, months)}
            <span className="text-muted"> · {nights === 1 ? '1 night' : `${String(nights)} nights`}</span>
          </span>
        );
      },
    }),
    columnHelper.display({
      id: 'rooms',
      header: () => <span className="block text-end">Rooms</span>,
      cell: (info) => (
        <span className="block text-end tabular-nums">
          {info.row.original.lines.reduce((total, line) => total + line.rooms, 0)}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'total',
      header: () => <span className="block text-end">Total</span>,
      cell: (info) => {
        const { total } = info.row.original;
        return (
          <span className="block text-end font-medium">
            <Amount amount={total.amount} currency={moneyFormat(total.currencyCode)} />
          </span>
        );
      },
    }),
  ]);
}
