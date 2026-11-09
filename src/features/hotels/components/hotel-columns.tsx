import { createColumnHelper } from '@tanstack/react-table';

import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { Button } from '@/components/ui/Button';
import type { CurrencyRecord } from '@/features/currencies';
import { formatMoney } from '@/lib/money/money';

import type { Hotel } from '../api/hotel.schemas';

const columnHelper = createColumnHelper<ServerTableFeatures, Hotel>();

interface HotelColumnOptions {
  currencies: readonly CurrencyRecord[];
  onEdit: (hotel: Hotel) => void;
  onSetActive: (hotel: Hotel, active: boolean) => void;
}

export function hotelColumns({ currencies, onEdit, onSetActive }: HotelColumnOptions) {
  const rate = (hotel: Hotel, value: string | undefined) => {
    if (!value) return <span className="text-muted block text-end">Not set</span>;
    const currency = currencies.find((item) => item.code === hotel.rateCurrency);
    return (
      <span className="block text-end tabular-nums">
        {formatMoney(value, currency ?? { symbol: hotel.rateCurrency ?? '', decimals: 2 })}
      </span>
    );
  };

  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: 'Hotel',
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor('city', { header: 'City' }),
    columnHelper.display({
      id: 'double',
      header: () => <span className="block text-end">Double</span>,
      cell: (info) => rate(info.row.original, info.row.original.doubleRate),
    }),
    columnHelper.display({
      id: 'extra',
      header: () => <span className="block text-end">Extra bed</span>,
      cell: (info) => rate(info.row.original, info.row.original.extraBedRate),
    }),
    columnHelper.display({
      id: 'flat',
      header: () => <span className="block text-end">Flat</span>,
      cell: (info) => rate(info.row.original, info.row.original.flatRate),
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: (info) => {
        const hotel = info.row.original;
        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Edit ${hotel.name}`}
              onClick={() => {
                onEdit(hotel);
              }}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`${hotel.active ? 'Deactivate' : 'Activate'} ${hotel.name}`}
              onClick={() => {
                onSetActive(hotel, !hotel.active);
              }}
            >
              {hotel.active ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        );
      },
    }),
  ]);
}
