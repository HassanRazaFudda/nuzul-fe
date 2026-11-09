import type { CurrencyRecord } from '@/features/currencies';
import { formatAmount, formatMoney } from '@/lib/money/money';

function currencyOf(currencies: readonly CurrencyRecord[], code: string) {
  return currencies.find((item) => item.code === code) ?? { symbol: code, decimals: 2 };
}

/** Formats amounts in the report's currency. */
export function moneyFormatter(currencies: readonly CurrencyRecord[], code: string) {
  const currency = currencyOf(currencies, code);
  return (amount: string) => formatMoney(amount, currency);
}

/** The figure alone, for a table column whose header names the currency. */
export function amountFormatter(currencies: readonly CurrencyRecord[], code: string) {
  const { decimals } = currencyOf(currencies, code);
  return (amount: string) => formatAmount(amount, decimals);
}

/** Excel takes real numbers, so a sheet can add them up. */
export const asNumber = (value: string) => Number(value);
