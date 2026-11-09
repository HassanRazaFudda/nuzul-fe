import { createColumnHelper } from '@tanstack/react-table';
import { Link } from 'react-router';

import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { Amount } from '@/components/ui/Amount';
import { RECORD_LINK_CLASS } from '@/components/ui/buttonStyles';
import { formatIsoDate } from '@/lib/format/dates';

import type { ContractView } from '../api/contract.schemas';
import { ContractTags } from './ContractTags';

const columnHelper = createColumnHelper<ServerTableFeatures, ContractView>();

export function contractColumns(moneyFormat: (code: string) => { symbol: string; decimals: number }) {
  return columnHelper.columns([
    columnHelper.accessor('number', {
      header: 'Number',
      cell: (info) => (
        <Link to={`/contracts/${info.row.original.id}`} className={RECORD_LINK_CLASS}>
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor('agentName', { id: 'agent', header: 'Agent' }),
    columnHelper.accessor('date', {
      header: 'Date',
      cell: (info) => <span className="whitespace-nowrap">{formatIsoDate(info.getValue())}</span>,
    }),
    columnHelper.display({
      id: 'hotels',
      header: 'Hotels',
      // One stay per hotel entry, so a hotel booked twice would otherwise be named twice.
      cell: (info) => [...new Set(info.row.original.hotels.map((entry) => entry.hotelName))].join(', '),
    }),
    columnHelper.display({
      id: 'tags',
      header: () => <span className="sr-only">Attention</span>,
      cell: (info) => <ContractTags tags={info.row.original.tags} />,
    }),
    columnHelper.display({
      id: 'total',
      header: () => <span className="block text-end">Total</span>,
      cell: (info) => {
        const { total } = info.row.original;
        return (
          <span className="block text-end">
            <Amount amount={total.amount} currency={moneyFormat(total.currencyCode)} />
          </span>
        );
      },
    }),
  ]);
}
