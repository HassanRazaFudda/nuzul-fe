import { Link } from 'react-router';

import { buttonClass } from '@/components/ui/buttonStyles';
import type { CalendarMonth } from '@/features/calendar';
import { useCan } from '@/lib/auth/session';
import { isoDate } from '@/lib/format/dates';

import type { LedgerNeedRow } from '../domain/ledger-engine';
import { DayCell } from './DayCell';

function purchaseLink(hotelId: string, roomTypeId: string, row: LedgerNeedRow) {
  const params = new URLSearchParams({
    hotel: hotelId,
    roomType: roomTypeId,
    checkIn: isoDate(row.from),
    checkOut: isoDate(row.to),
    rooms: String(row.buy),
  });
  return `/purchases/new?${params.toString()}`;
}

interface BuyListProps {
  hotelId: string;
  roomTypeId: string;
  need: LedgerNeedRow[];
  months: CalendarMonth[];
}

/** What to buy to clear the shortage, each one a step away from a pre-filled purchase. */
export function BuyList({ hotelId, roomTypeId, need, months }: BuyListProps) {
  const canPurchase = useCan()('purchase.create');
  return (
    <ul className="divide-border divide-y">
      {need.map((row) => (
        <li key={row.from} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="text-foreground">
            Buy <span className="font-semibold tabular-nums">{row.buy}</span>{' '}
            {row.buy === 1 ? 'room' : 'rooms'}, <DayCell day={row.from} months={months} /> to{' '}
            <DayCell day={row.to} months={months} />
          </span>
          {canPurchase && (
            <Link
              to={purchaseLink(hotelId, roomTypeId, row)}
              aria-label={`Purchase ${String(row.buy)} rooms`}
              className={buttonClass('secondary', 'sm')}
            >
              Purchase
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
