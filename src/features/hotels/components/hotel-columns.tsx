import { createColumnHelper } from '@tanstack/react-table';
import { BookOpenCheck, Pencil, Power } from 'lucide-react';

import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { Menu } from '@/components/ui/Menu';
import type { CurrencyRecord } from '@/features/currencies';
import { formatAmount } from '@/lib/money/money';

import type { Hotel } from '../api/hotel.schemas';

const columnHelper = createColumnHelper<ServerTableFeatures, Hotel>();

interface HotelColumnOptions {
  currencies: readonly CurrencyRecord[];
  onEdit: (hotel: Hotel) => void;
  onSetActive: (hotel: Hotel, active: boolean) => void;
  canManage: boolean;
}

export function hotelColumns({ currencies, onEdit, onSetActive, canManage }: HotelColumnOptions) {
  /** Reference rates in the hotel's own currency, with the code quiet. */
  const rate = (hotel: Hotel, value: string | undefined) => {
    if (!value) return <span className="text-faint block text-end">—</span>;
    const currency = currencies.find((item) => item.code === hotel.rateCurrency);
    return (
      <span className="block text-end whitespace-nowrap tabular-nums">
        <span className="text-muted text-xs">{hotel.rateCurrency}</span>{' '}
        {formatAmount(value, currency?.decimals ?? 2)}
      </span>
    );
  };

  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: 'Hotel',
      cell: (info) =>
        canManage ? (
          <button
            type="button"
            onClick={() => {
              onEdit(info.row.original);
            }}
            className="text-foreground text-start font-medium hover:underline"
          >
            {info.getValue()}
          </button>
        ) : (
          <span className="font-medium">{info.getValue()}</span>
        ),
    }),
    columnHelper.accessor('city', {
      header: 'City',
      cell: (info) => <span className="text-secondary">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: 'double',
      header: () => <span className="block text-end">Double rate</span>,
      cell: (info) => rate(info.row.original, info.row.original.doubleRate),
    }),
    columnHelper.display({
      id: 'extra',
      header: () => <span className="block text-end">Extra bed</span>,
      cell: (info) => rate(info.row.original, info.row.original.extraBedRate),
    }),
    columnHelper.display({
      id: 'flat',
      header: () => <span className="block text-end">Flat rate</span>,
      cell: (info) => rate(info.row.original, info.row.original.flatRate),
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: (info) => {
        const hotel = info.row.original;
        return (
          <div className="flex justify-end">
            <Menu
              label={`Actions for ${hotel.name}`}
              items={[
                {
                  label: 'Rooms in the ledger',
                  icon: <BookOpenCheck aria-hidden />,
                  to: `/inventory?hotel=${hotel.id}`,
                },
                canManage && {
                  label: 'Edit',
                  icon: <Pencil aria-hidden />,
                  onSelect: () => {
                    onEdit(hotel);
                  },
                },
                canManage && {
                  label: hotel.active ? 'Deactivate' : 'Activate',
                  icon: <Power aria-hidden />,
                  hint: hotel.active ? 'Hidden from new records, kept on old ones' : undefined,
                  tone: hotel.active ? 'danger' : undefined,
                  onSelect: () => {
                    onSetActive(hotel, !hotel.active);
                  },
                },
              ]}
            />
          </div>
        );
      },
    }),
  ]);
}
