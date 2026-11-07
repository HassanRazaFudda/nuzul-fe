import { createColumnHelper } from '@tanstack/react-table';
import { Link } from 'react-router';

import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { formatDay, type CalendarMonth } from '@/features/calendar';
import { nightsBetween } from '@/lib/format/dates';
import { formatMoney } from '@/lib/money/money';

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
        <Link to={`/purchases/${info.row.original.id}`} className="text-primary-strong font-medium underline">
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor('hotelName', { header: 'Hotel', enableSorting: false }),
    columnHelper.accessor('vendorName', { id: 'vendor', header: 'Vendor' }),
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
          <span className="block text-end whitespace-nowrap tabular-nums">
            {formatMoney(total.amount, moneyFormat(total.currencyCode))}
          </span>
        );
      },
    }),
  ]);
}
