import { InventoryStateTag, nightState } from '@/features/inventory';
import { formatDay, type CalendarMonth } from '@/features/calendar';
import { isoDate } from '@/lib/format/dates';

import type { Impact } from '../domain/impact';

export interface ImpactNames {
  hotelName: (id: string) => string;
  roomTypeName: (id: string) => string;
}

interface ImpactPreviewProps {
  impact: Impact;
  names: ImpactNames;
  months: CalendarMonth[];
}

const change = (before: number, after: number) =>
  before === after ? String(after) : `${String(before)} → ${String(after)}`;

/** The ledger before and after, only where something changes, and the sales losing a vendor. */
export function ImpactPreview({ impact, names, months }: ImpactPreviewProps) {
  const day = (index: number) => formatDay(isoDate(index), months);
  const range = (checkIn: string, checkOut: string) =>
    `${formatDay(checkIn, months)} to ${formatDay(checkOut, months)}`;

  if (impact.pools.length === 0 && impact.lostCover.length === 0) {
    return <p className="text-foreground">Nothing changes on the ledger.</p>;
  }

  return (
    <div className="space-y-4">
      {impact.lostCover.length > 0 && (
        <section>
          <h3 className="text-foreground text-sm font-semibold">Sales losing their vendor</h3>
          <ul className="mt-1 space-y-0.5">
            {impact.lostCover.map((item) => (
              <li key={`${item.saleId}-${item.checkIn}`}>
                {item.reference}, {names.hotelName(item.hotelId)} {names.roomTypeName(item.roomTypeId)}:{' '}
                <span className="font-semibold tabular-nums">{item.rooms}</span>{' '}
                {item.rooms === 1 ? 'room' : 'rooms'}, {range(item.checkIn, item.checkOut)}
              </li>
            ))}
          </ul>
        </section>
      )}
      {impact.pools.map((pool) => (
        <section key={`${pool.hotelId}/${pool.roomTypeId}`}>
          <h3 className="text-foreground text-sm font-semibold">
            {names.hotelName(pool.hotelId)}, {names.roomTypeName(pool.roomTypeId)}
          </h3>
          <div className="overflow-x-auto">
            <table className="mt-1 w-full text-xs">
              <caption className="sr-only">
                Ledger before and after for {names.hotelName(pool.hotelId)},{' '}
                {names.roomTypeName(pool.roomTypeId)}
              </caption>
              <thead>
                <tr className="text-muted">
                  <th scope="col" className="py-1 text-start font-semibold">
                    Nights
                  </th>
                  <th scope="col" className="py-1 text-end font-semibold">
                    Purchased
                  </th>
                  <th scope="col" className="py-1 text-end font-semibold">
                    Sold
                  </th>
                  <th scope="col" className="py-1 text-end font-semibold">
                    Available
                  </th>
                  <th scope="col" className="py-1 ps-3 text-start font-semibold">
                    After
                  </th>
                </tr>
              </thead>
              <tbody>
                {pool.rows.map((row) => (
                  <tr key={row.from} className="border-border text-foreground border-t">
                    <td className="py-1.5 whitespace-nowrap">
                      {day(row.from)} to {day(row.to)}
                    </td>
                    <td className="py-1.5 text-end tabular-nums">
                      {change(row.before.purchased, row.after.purchased)}
                    </td>
                    <td className="py-1.5 text-end tabular-nums">
                      {change(row.before.sold, row.after.sold)}
                    </td>
                    <td className="py-1.5 text-end tabular-nums">
                      {change(row.before.available, row.after.available)}
                    </td>
                    <td className="py-1.5 ps-3">
                      <InventoryStateTag
                        state={nightState(row.after.available)}
                        rooms={Math.abs(row.after.available)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
