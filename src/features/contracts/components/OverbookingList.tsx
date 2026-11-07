import { formatDay, type CalendarMonth } from '@/features/calendar';
import type { RoomType } from '@/features/room-types';
import { isoDate } from '@/lib/format/dates';

import type { OverbookingPreview } from '../domain/overbooking';

interface OverbookingListProps {
  preview: OverbookingPreview;
  hotelName: (id: string) => string;
  roomTypes: readonly RoomType[];
  months: CalendarMonth[];
}

/** The shortage in full: hotel, type, nights and rooms, and any source that could cover it. */
export function OverbookingList({ preview, hotelName, roomTypes, months }: OverbookingListProps) {
  const typeName = (id: string) => roomTypes.find((type) => type.id === id)?.name ?? id;
  const dayLabel = (day: number) => formatDay(isoDate(day), months);

  return (
    <>
      <ul className="space-y-0.5">
        {preview.shortages.map((shortage) => (
          <li key={`${shortage.hotelId}-${shortage.roomTypeId}-${String(shortage.from)}`}>
            {hotelName(shortage.hotelId)}, {typeName(shortage.roomTypeId)}: short by{' '}
            <span className="font-semibold tabular-nums">{shortage.rooms}</span>, {dayLabel(shortage.from)} to{' '}
            {dayLabel(shortage.to)}
          </li>
        ))}
      </ul>
      {preview.suggestions.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {preview.suggestions.map((suggestion) => (
            <li key={`${suggestion.hotelId}-${suggestion.soldAsTypeId}-${suggestion.sourceTypeId}`}>
              {typeName(suggestion.sourceTypeId)} has {suggestion.free} free at{' '}
              {hotelName(suggestion.hotelId)}, and selling it as {typeName(suggestion.soldAsTypeId)} is
              allowed. You could use that source instead.
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
