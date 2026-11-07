import { createColumnHelper } from '@tanstack/react-table';
import { Link } from 'react-router';

import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { formatIsoDate } from '@/lib/format/dates';
import { formatMoney } from '@/lib/money/money';

import type { ContractView } from '../api/contract.schemas';
import { ContractTags } from './ContractTags';

const columnHelper = createColumnHelper<ServerTableFeatures, ContractView>();

export function contractColumns(moneyFormat: (code: string) => { symbol: string; decimals: number }) {
  return columnHelper.columns([
    columnHelper.accessor('number', {
      header: 'Number',
      cell: (info) => (
        <Link to={`/contracts/${info.row.original.id}`} className="text-primary-strong font-medium underline">
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
      cell: (info) => info.row.original.hotels.map((entry) => entry.hotelName).join(', '),
    }),
    columnHelper.display({
      id: 'tags',
      header: 'Attention',
      cell: (info) => <ContractTags tags={info.row.original.tags} />,
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
