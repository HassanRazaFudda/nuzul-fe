/**
 * The configurable calendar.
 *
 * Stored truth is always the Gregorian date. A Hijri (or any other) date is only
 * a way of naming it, through months the administrator configures: any number of
 * months, any number of days. Editing a month changes how dates read, never
 * which night a booking occupies.
 */

import { dayNumber, isoDate } from '@/lib/format/dates';

export interface CalendarMonth {
  id: string;
  /** The year or cycle it belongs to, e.g. "1448". */
  cycle: string;
  /** Position within the cycle, 1 first. */
  ordinal: number;
  name: string;
  days: number;
  /** Gregorian date of day 1, yyyy-mm-dd. */
  startDate: string;
}

/** Months in date order. */
export function sortMonths(months: CalendarMonth[]): CalendarMonth[] {
  return [...months].sort((a, b) => dayNumber(a.startDate) - dayNumber(b.startDate));
}

/** Problems with a set of months; empty when they chain with no gap and no overlap. */
export function calendarProblems(months: CalendarMonth[]): string[] {
  const problems: string[] = [];
  const sorted = sortMonths(months);
  sorted.forEach((month, index) => {
    if (!Number.isInteger(month.days) || month.days < 1) {
      problems.push(`${month.name} ${month.cycle}: the number of days must be at least 1.`);
    }
    const next = sorted[index + 1];
    if (!next) return;
    const expected = dayNumber(month.startDate) + month.days;
    const actual = dayNumber(next.startDate);
    if (actual > expected) {
      problems.push(
        `Gap: ${month.name} ${month.cycle} ends ${isoDate(expected - 1)}, ${next.name} ${next.cycle} starts ${next.startDate}.`,
      );
    } else if (actual < expected) {
      problems.push(
        `Overlap: ${month.name} ${month.cycle} runs to ${isoDate(expected - 1)}, ${next.name} ${next.cycle} starts ${next.startDate}.`,
      );
    }
  });
  return problems;
}

/** A day in a configured month, as its Gregorian date. Null when the day does not exist. */
export function monthDayToIso(month: CalendarMonth, day: number): string | null {
  if (!Number.isInteger(day) || day < 1 || day > month.days) return null;
  return isoDate(dayNumber(month.startDate) + day - 1);
}

export interface CalendarDay {
  month: CalendarMonth;
  day: number;
}

/** The configured month and day of a Gregorian date. Null outside the configured months. */
export function isoToMonthDay(iso: string, months: CalendarMonth[]): CalendarDay | null {
  const target = dayNumber(iso);
  for (const month of months) {
    const offset = target - dayNumber(month.startDate);
    if (offset >= 0 && offset < month.days) return { month, day: offset + 1 };
  }
  return null;
}

/** "25 Zul-Qadah", falling back to the Gregorian date when it is outside the calendar. */
export function formatDay(iso: string, months: CalendarMonth[]): string {
  const found = isoToMonthDay(iso, months);
  return found ? `${found.day} ${found.month.name}` : iso;
}
