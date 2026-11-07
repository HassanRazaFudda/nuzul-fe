/**
 * Date-only business values (stay dates, validity) are ISO "YYYY-MM-DD" strings,
 * and arithmetic goes through UTC so a time zone can never move a night.
 */

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A yyyy-mm-dd date as a whole day number: the ledger's night index. */
export function dayNumber(iso: string): number {
  const match = ISO_DATE.exec(iso);
  if (!match) throw new RangeError(`Not a yyyy-mm-dd date: ${iso}`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError(`No such date: ${iso}`);
  }
  return ms / MS_PER_DAY;
}

/** The yyyy-mm-dd date of a day number. */
export function isoDate(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole nights between two dates; the check-out night is not counted. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  return dayNumber(checkOut) - dayNumber(checkIn);
}

/** Today on this computer's clock, as yyyy-mm-dd. Takes `now` so callers stay pure. */
export function todayIso(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/** "8 May 2027". Display only. */
export function formatIsoDate(iso: string, locale = 'en-GB'): string {
  let formatter = dateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
    dateFormatters.set(locale, formatter);
  }
  return formatter.format(new Date(`${iso}T00:00:00Z`));
}
