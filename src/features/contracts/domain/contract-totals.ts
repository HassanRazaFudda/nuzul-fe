/**
 * What a contract charges. Pure, and the same on the backend later. Rounding happens once
 * per amount, to the currency's decimals, and totals add the rounded amounts.
 */

import { nightsBetween } from '@/lib/format/dates';
import { dec, roundTo, sum } from '@/lib/money/money';

export type RateType = 'occupancy' | 'flat';

export interface EntryRates {
  rateType: RateType;
  doubleRate: string;
  extraBedRate: string;
  flatRate: string;
}

const DOUBLE_CAPACITY = 2;

/** Double = double rate, each guest above two adds an extra bed; flat is one rate for all. */
export function lineRate(rates: EntryRates, capacity: number): string {
  if (rates.rateType === 'flat') return dec(rates.flatRate || 0).toString();
  const extraBeds = Math.max(capacity - DOUBLE_CAPACITY, 0);
  return dec(rates.doubleRate || 0)
    .plus(dec(rates.extraBedRate || 0).times(extraBeds))
    .toString();
}

export interface TotalsLine {
  capacity: number;
  rooms: number;
  personsPerRoom: number;
}

export interface TotalsEntry extends EntryRates {
  checkIn: string;
  checkOut: string;
  perNight: boolean;
  noMeals: boolean;
  lines: TotalsLine[];
}

export interface LineTotals {
  rate: string;
  roomAmount: string;
  mealIncome: string;
}

export interface EntryTotals {
  nights: number;
  lines: LineTotals[];
  roomAmount: string;
  mealIncome: string;
  total: string;
}

export interface ContractTotals {
  hotels: EntryTotals[];
  roomAmount: string;
  mealIncome: string;
  total: string;
}

/** `mealRate` is null when the contract has no meal plan. */
export function contractTotals(
  entries: TotalsEntry[],
  mealRate: string | null,
  decimals: number,
): ContractTotals {
  const hotels = entries.map((entry): EntryTotals => {
    const nights = nightsBetween(entry.checkIn, entry.checkOut);
    const lines = entry.lines.map((line): LineTotals => {
      const rate = lineRate(entry, line.capacity);
      const meal = mealRate === null || entry.noMeals ? '0' : mealRate;
      return {
        rate,
        roomAmount: roundTo(
          dec(rate)
            .times(line.rooms)
            .times(entry.perNight ? nights : 1),
          decimals,
        ),
        mealIncome: roundTo(dec(meal).times(line.rooms).times(line.personsPerRoom).times(nights), decimals),
      };
    });
    const roomAmount = roundTo(sum(lines.map((line) => line.roomAmount)), decimals);
    const mealIncome = roundTo(sum(lines.map((line) => line.mealIncome)), decimals);
    return { nights, lines, roomAmount, mealIncome, total: roundTo(sum([roomAmount, mealIncome]), decimals) };
  });
  const roomAmount = roundTo(sum(hotels.map((hotel) => hotel.roomAmount)), decimals);
  const mealIncome = roundTo(sum(hotels.map((hotel) => hotel.mealIncome)), decimals);
  return { hotels, roomAmount, mealIncome, total: roundTo(sum([roomAmount, mealIncome]), decimals) };
}
