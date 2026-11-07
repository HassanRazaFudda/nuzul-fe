import { createColumnHelper } from '@tanstack/react-table';

import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { Button } from '@/components/ui/Button';
import { dayNumber, isoDate } from '@/lib/format/dates';

import type { CalendarMonth } from '../domain/calendar';

const columnHelper = createColumnHelper<ServerTableFeatures, CalendarMonth>();

const endDate = (month: CalendarMonth) => isoDate(dayNumber(month.startDate) + month.days - 1);

interface MonthColumnOptions {
  onEdit: (month: CalendarMonth) => void;
  onRemove: (month: CalendarMonth) => void;
}

export function monthColumns({ onEdit, onRemove }: MonthColumnOptions) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: 'Month',
      enableSorting: false,
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor('cycle', { header: 'Year', enableSorting: false }),
    columnHelper.accessor('ordinal', {
      enableSorting: false,
      header: () => <span className="block text-end">No.</span>,
      cell: (info) => <span className="block text-end tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.accessor('days', {
      enableSorting: false,
      header: () => <span className="block text-end">Days</span>,
      cell: (info) => <span className="block text-end tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.accessor('startDate', {
      header: 'Starts',
      enableSorting: false,
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: 'end',
      header: 'Ends',
      cell: (info) => <span className="tabular-nums">{endDate(info.row.original)}</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const month = info.row.original;
        const name = `${month.name} ${month.cycle}`;
        return (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Edit ${name}`}
              onClick={() => {
                onEdit(month);
              }}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove ${name}`}
              onClick={() => {
                onRemove(month);
              }}
            >
              Remove
            </Button>
          </div>
        );
      },
    }),
  ]);
}
