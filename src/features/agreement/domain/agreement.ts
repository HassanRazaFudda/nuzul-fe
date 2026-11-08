/**
 * The Hotel Accommodation Agreement's wording, worked out from a contract. Pure: the print
 * page only lays it out. The format follows the owner's agreement (FORMET.pdf).
 */

import { isoToMonthDay, type CalendarMonth } from '@/features/calendar';
import { dec } from '@/lib/money/money';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export interface AgreementLine {
  soldAsTypeId: string;
  rooms: number;
  rate: string;
}

export interface AgreementHotel {
  hotelName: string;
  checkIn: string;
  checkOut: string;
  perNight: boolean;
  noMeals: boolean;
  lines: AgreementLine[];
  total: { amount: string };
}

export interface AgreementContract {
  date: string;
  currencyCode: string;
  mealPlan: { kind: 'none' } | { kind: 'perNightPerPerson' | 'halfboard' | 'fullboard'; rate: string };
  hotels: AgreementHotel[];
  total: { amount: string };
}

export interface AgreementRow {
  hotel: string;
  from: string;
  to: string;
  rooms: string[];
  /** "ROOM RATE :" when every line shares one rate, printed above it. */
  rateLabel: string | null;
  rates: string[];
  rateBasis: string;
  total: string;
}

export interface AgreementDocument {
  season: string;
  /** "29th", for "on this 29th day of August, 2026". */
  dayOrdinal: string;
  monthYear: string;
  rows: AgreementRow[];
  grandTotal: string;
  mealPlan: string;
}

const MEAL_WORDS = {
  perNightPerPerson: 'PER NIGHT PER PERSON',
  halfboard: 'HALFBOARD',
  fullboard: 'FULLBOARD',
} as const;

export function ordinal(day: number): string {
  const teen = day % 100 >= 11 && day % 100 <= 13;
  const suffix = teen ? 'th' : (['th', 'st', 'nd', 'rd'][day % 10] ?? 'th');
  return `${String(day)}${suffix}`;
}

/** Whole amounts without decimals, others with their own: "90,000", "1,250.50". */
export function amountWords(amount: string): string {
  const value = dec(amount);
  const fixed = value.isInteger() ? value.toFixed(0) : value.toFixed(2);
  const [whole = '0', fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/** The agreement writes Saudi riyals as "SR" after a total, as in the owner's format. */
const totalUnit = (currencyCode: string) => (currencyCode === 'SAR' ? 'SR' : currencyCode);

/** "01 ZUL-HIJJAH", or the English date when outside the calendar. */
export function periodDay(iso: string, months: CalendarMonth[]): string {
  const found = isoToMonthDay(iso, months);
  if (!found) {
    const [year, month, day] = iso.split('-');
    return `${day ?? ''} ${(MONTHS[Number(month) - 1] ?? '').toUpperCase()} ${year ?? ''}`.trim();
  }
  return `${String(found.day).padStart(2, '0')} ${found.month.name.toUpperCase()}`;
}

/** "HAJJ 1448 H / 2027": the calendar year of the first night, and its English year. */
export function seasonLine(seasonWord: string, firstCheckIn: string, months: CalendarMonth[]): string {
  const year = firstCheckIn.slice(0, 4);
  const found = isoToMonthDay(firstCheckIn, months);
  return found ? `${seasonWord} ${found.month.cycle} H / ${year}` : `${seasonWord} ${year}`;
}

interface DocumentContext {
  months: CalendarMonth[];
  seasonWord: string;
  shortName: (roomTypeId: string) => string;
}

export function agreementDocument(contract: AgreementContract, context: DocumentContext): AgreementDocument {
  const { currencyCode } = contract;
  const unit = totalUnit(currencyCode);
  const [year = '', month = '1', day = '1'] = contract.date.split('-');
  const firstCheckIn = [...contract.hotels].map((hotel) => hotel.checkIn).sort()[0] ?? contract.date;
  const mealPlan =
    contract.mealPlan.kind === 'none'
      ? 'No meal plan'
      : `[ ${MEAL_WORDS[contract.mealPlan.kind]} ${amountWords(contract.mealPlan.rate)} ${unit} ]`;
  const optedOut = contract.hotels
    .filter((hotel) => hotel.noMeals)
    .map((hotel) => hotel.hotelName.toUpperCase());

  return {
    season: seasonLine(context.seasonWord, firstCheckIn, context.months),
    dayOrdinal: ordinal(Number(day)),
    monthYear: `${MONTHS[Number(month) - 1] ?? ''}, ${year}`,
    rows: contract.hotels.map((hotel) => {
      const rates = [...new Set(hotel.lines.map((line) => dec(line.rate).toString()))];
      return {
        hotel: hotel.hotelName.toUpperCase(),
        from: periodDay(hotel.checkIn, context.months),
        to: periodDay(hotel.checkOut, context.months),
        rooms: hotel.lines.map(
          (line) => `${String(line.rooms).padStart(2, '0')} ${context.shortName(line.soldAsTypeId)}`,
        ),
        rateLabel: rates.length === 1 ? 'ROOM RATE :' : null,
        rates:
          rates.length === 1
            ? [`${amountWords(rates[0] ?? '0')} ${currencyCode}`]
            : hotel.lines.map(
                (line) => `${context.shortName(line.soldAsTypeId)} ${amountWords(line.rate)} ${currencyCode}`,
              ),
        rateBasis: hotel.perNight ? 'per night' : 'for the stay',
        total: `${amountWords(hotel.total.amount)}/-${unit}`,
      };
    }),
    grandTotal: `${amountWords(contract.total.amount)} ${currencyCode}`,
    mealPlan:
      optedOut.length > 0 && contract.mealPlan.kind !== 'none'
        ? `${mealPlan}, not at ${optedOut.join(', ')}`
        : mealPlan,
  };
}
