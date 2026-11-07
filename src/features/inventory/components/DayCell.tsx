import { formatDay, type CalendarMonth } from '@/features/calendar';
import { formatIsoDate, isoDate } from '@/lib/format/dates';

interface DayCellProps {
  /** A night index from the engine. */
  day: number;
  months: CalendarMonth[];
}

/** One date in both forms: the calendar's name, and the English date it stands for. */
export function DayCell({ day, months }: DayCellProps) {
  const iso = isoDate(day);
  return (
    <span className="whitespace-nowrap">
      {formatDay(iso, months)} <span className="text-muted text-xs">({formatIsoDate(iso)})</span>
    </span>
  );
}
