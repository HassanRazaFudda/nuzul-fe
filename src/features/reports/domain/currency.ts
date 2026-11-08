/**
 * Turning stored amounts into the report's currency. Every stored amount keeps what was
 * entered, its currency and the rate used, so either policy can be worked out at any time.
 */

import type Decimal from 'decimal.js';

import { dec, rateOn, type ExchangeRate } from '@/lib/money/money';

export interface Money {
  amount: string;
  currencyCode: string;
  rateToPkr: string;
}

export type Convert = (money: Money) => Decimal;

export type RatePolicy = 'transaction' | 'revaluation';

const BASE = 'PKR';

export class MissingRateError extends Error {
  override readonly name = 'MissingRateError';
  readonly currencyCode: string;
  readonly date: string;

  constructor(currencyCode: string, date: string) {
    super(`${currencyCode} has no rate on ${date}`);
    this.currencyCode = currencyCode;
    this.date = date;
  }
}

/**
 * - Transaction-date: an amount already in the report currency stays as entered; any other
 *   goes through its own stored PKR value, then into the report currency at its rate on `on`.
 * - Revaluation: every amount at the rates on `on`.
 */
export function converter(
  policy: RatePolicy,
  reportCurrency: string,
  on: string,
  rates: readonly ExchangeRate[],
): Convert {
  const rateOf = (code: string) => {
    if (code === BASE) return dec(1);
    const found = rateOn(rates, code, on);
    if (!found) throw new MissingRateError(code, on);
    return dec(found.rateToPkr);
  };
  const reportRate = rateOf(reportCurrency);

  if (policy === 'transaction') {
    return (money) =>
      money.currencyCode === reportCurrency
        ? dec(money.amount)
        : dec(money.amount).times(money.rateToPkr).dividedBy(reportRate);
  }
  return (money) => dec(money.amount).times(rateOf(money.currencyCode)).dividedBy(reportRate);
}
