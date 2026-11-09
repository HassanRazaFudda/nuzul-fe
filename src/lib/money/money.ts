/**
 * Money. Amounts are decimal strings and arithmetic goes through decimal.js, so a
 * JS number never holds money. Rounding is half-up, once per line, to the
 * currency's decimals.
 */

import Decimal from 'decimal.js';

export interface Currency {
  code: string;
  symbol: string;
  decimals: number;
  enabled: boolean;
}

/** A rate from the history: PKR for one unit of the currency. Never overwritten. */
export interface ExchangeRate {
  id: string;
  currencyCode: string;
  rateToPkr: string;
  /** yyyy-mm-dd. */
  effectiveFrom: string;
}

/** Every monetary line keeps what was entered and the rate used at that moment. */
export interface MoneyLine {
  amount: string;
  currencyCode: string;
  rateToPkr: string;
  amountPkr: string;
}

export type DecimalLike = Decimal.Value;

const Precise = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export const dec = (value: DecimalLike) => new Precise(value);

/** Rounds half-up to the currency's decimals and returns a fixed string. */
export function roundTo(value: DecimalLike, decimals: number): string {
  return dec(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toFixed(decimals);
}

/** Sums decimal strings exactly. */
export function sum(values: DecimalLike[]): string {
  return values.reduce<Decimal>((total, value) => total.plus(value), dec(0)).toString();
}

/** Freezes an entered amount with its rate. PKR amounts always hold 2 decimals. */
export function moneyLine(amount: string, currencyCode: string, rateToPkr: string): MoneyLine {
  return {
    amount,
    currencyCode,
    rateToPkr,
    amountPkr: roundTo(dec(amount).times(rateToPkr), 2),
  };
}

/** A stored line in a reporting currency, using the line's own frozen rate. */
export function lineInCurrency(line: MoneyLine, reportingRateToPkr: string, decimals: number): string {
  return roundTo(dec(line.amountPkr).dividedBy(reportingRateToPkr), decimals);
}

/**
 * The rate in force on a date: the latest entry not after it. Null when the
 * currency has none yet. Past lines never use this; they keep their frozen rate.
 */
export function rateOn(
  rates: readonly ExchangeRate[],
  currencyCode: string,
  date: string,
): ExchangeRate | null {
  let found: ExchangeRate | null = null;
  for (const rate of rates) {
    if (rate.currencyCode !== currencyCode || rate.effectiveFrom > date) continue;
    if (!found || rate.effectiveFrom >= found.effectiveFrom) found = rate;
  }
  return found;
}

/** Weighted average: total cost over total room-nights. Never an average of rates. */
export function weightedAverage(items: { cost: DecimalLike; roomNights: number }[]): Decimal | null {
  const roomNights = items.reduce((total, item) => total + item.roomNights, 0);
  if (roomNights === 0) return null;
  return dec(sum(items.map((item) => item.cost))).dividedBy(roomNights);
}

/** "1,234.50", for a column whose header already names the currency. */
export function formatAmount(amount: DecimalLike, decimals: number): string {
  const fixed = roundTo(amount, decimals);
  const negative = fixed.startsWith('-');
  const [whole = '0', fraction] = (negative ? fixed.slice(1) : fixed).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/** "SAR 1,234.50" for display. */
export function formatMoney(amount: DecimalLike, currency: Pick<Currency, 'symbol' | 'decimals'>): string {
  const amountText = formatAmount(amount, currency.decimals);
  const negative = amountText.startsWith('-');
  return `${negative ? '-' : ''}${currency.symbol} ${negative ? amountText.slice(1) : amountText}`;
}
