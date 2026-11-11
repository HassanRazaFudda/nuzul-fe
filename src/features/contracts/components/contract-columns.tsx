import { createColumnHelper } from '@tanstack/react-table';
import { Link } from 'react-router';

import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { Amount } from '@/components/ui/Amount';
import { RECORD_LINK_CLASS } from '@/components/ui/buttonStyles';
import { formatDay, type CalendarMonth } from '@/features/calendar';
import { formatIsoDate } from '@/lib/format/dates';

import type { ContractView } from '../api/contract.schemas';
import { ContractTags } from './ContractTags';

const columnHelper = createColumnHelper<ServerTableFeatures, ContractView>();

interface ContractColumnOptions {
  months: CalendarMonth[];
  moneyFormat: (code: string) => { symbol: string; decimals: number };
}

export function contractColumns({ months, moneyFormat }: ContractColumnOptions) {
  return columnHelper.columns([
    columnHelper.accessor('number', {
      header: 'Number',
      cell: (info) => (
        <Link to={`/contracts/${info.row.original.id}`} className={RECORD_LINK_CLASS}>
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor('agentName', {
      id: 'agent',
      header: 'Agent',
      cell: (info) => <span className="text-foreground font-medium">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: 'hotels',
      header: 'Hotels and stay',
      cell: (info) => {
        const { hotels } = info.row.original;
        // One stay per hotel entry, so a hotel booked twice would otherwise be named twice.
        const names = [...new Set(hotels.map((entry) => entry.hotelName))].join(', ');
        const checkIns = hotels.map((entry) => entry.checkIn).toSorted();
        const checkOuts = hotels.map((entry) => entry.checkOut).toSorted();
        const first = checkIns[0];
        const last = checkOuts.at(-1);
        const rooms = hotels.reduce(
          (total, entry) => total + entry.lines.reduce((sum, line) => sum + line.rooms, 0),
          0,
        );
        return (
          <span className="block min-w-0">
            <span className="text-foreground block">{names}</span>
            {first && last && (
              <span className="text-muted block text-xs whitespace-nowrap">
                {formatDay(first, months)} to {formatDay(last, months)} · {rooms}{' '}
                {rooms === 1 ? 'room' : 'rooms'}
              </span>
            )}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: 'tags',
      header: 'Flags',
      cell: (info) => <ContractTags tags={info.row.original.tags} />,
    }),
    columnHelper.accessor('date', {
      header: 'Signed',
      cell: (info) => (
        <span className="text-secondary whitespace-nowrap">{formatIsoDate(info.getValue())}</span>
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
