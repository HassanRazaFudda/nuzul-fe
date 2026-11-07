import { describe, expect, it } from 'vitest';

import { dayNumber, formatIsoDate, isoDate, nightsBetween, todayIso } from './dates';

describe('dates', () => {
  it('turns a date into a night index and back', () => {
    expect(isoDate(dayNumber('2027-05-08'))).toBe('2027-05-08');
    expect(dayNumber('2027-05-09') - dayNumber('2027-05-08')).toBe(1);
  });

  it('refuses a date that does not exist', () => {
    expect(() => dayNumber('2027-02-30')).toThrow(RangeError);
    expect(() => dayNumber('8 May')).toThrow(RangeError);
  });

  it('does not count the check-out night', () => {
    expect(nightsBetween('2027-05-08', '2027-05-12')).toBe(4);
  });

  it('reads today from the local clock it is given', () => {
    expect(todayIso(new Date(2026, 10, 7, 23, 30))).toBe('2026-11-07');
  });

  it('formats without shifting the day', () => {
    expect(formatIsoDate('2027-05-08')).toBe('8 May 2027');
  });
});
