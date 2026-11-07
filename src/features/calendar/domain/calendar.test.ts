import { describe, expect, it } from 'vitest';

import { dayNumber, nightsBetween } from '@/lib/format/dates';

import { calendarProblems, formatDay, isoToMonthDay, monthDayToIso, type CalendarMonth } from './calendar';

const zq: CalendarMonth = {
  id: 'zq',
  cycle: '1448',
  ordinal: 11,
  name: 'Zul-Qadah',
  days: 29,
  startDate: '2027-04-09',
};
const zh: CalendarMonth = {
  id: 'zh',
  cycle: '1448',
  ordinal: 12,
  name: 'Zul-Hijjah',
  days: 30,
  startDate: '2027-05-08',
};
const muharram: CalendarMonth = {
  id: 'mu',
  cycle: '1449',
  ordinal: 1,
  name: 'Muharram',
  days: 25,
  startDate: '2027-06-07',
};
const months = [zq, zh, muharram];

describe('configured months', () => {
  it('handles any month length, including a short one', () => {
    expect(monthDayToIso(muharram, 25)).toBe('2027-07-01');
    expect(monthDayToIso(muharram, 26)).toBeNull();
    expect(monthDayToIso(zq, 0)).toBeNull();
  });

  it('crosses month and year boundaries', () => {
    expect(formatDay('2027-05-07', months)).toBe('29 Zul-Qadah');
    expect(formatDay('2027-05-08', months)).toBe('1 Zul-Hijjah');
    expect(formatDay('2027-06-07', months)).toBe('1 Muharram');
    expect(isoToMonthDay('2027-06-07', months)?.month.cycle).toBe('1449');
    // A stay across the year boundary: 28 Zul-Hijjah to 3 Muharram.
    expect(nightsBetween(monthDayToIso(zh, 28) ?? '', monthDayToIso(muharram, 3) ?? '')).toBe(5);
  });

  it('falls back to the Gregorian date outside the calendar', () => {
    expect(formatDay('2030-01-01', months)).toBe('2030-01-01');
  });

  it('accepts months that chain, and names gaps and overlaps', () => {
    expect(calendarProblems(months)).toEqual([]);
    expect(calendarProblems([zq, { ...zh, startDate: '2027-05-10' }])).toEqual([
      expect.stringMatching(/^Gap/),
    ]);
    expect(calendarProblems([zq, { ...zh, startDate: '2027-05-01' }])).toEqual([
      expect.stringMatching(/^Overlap/),
    ]);
    expect(calendarProblems([{ ...zq, days: 0 }])).toEqual([expect.stringMatching(/at least 1/)]);
  });

  it('changing a month length moves a label, never a stored night', () => {
    const stored = '2027-05-08';
    const before = dayNumber(stored);
    expect(formatDay(stored, [{ ...zq, days: 30 }])).toBe('30 Zul-Qadah');
    expect(dayNumber(stored)).toBe(before);
  });
});
