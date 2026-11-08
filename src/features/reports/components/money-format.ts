import type { CurrencyRecord } from '@/features/currencies';
import { formatMoney } from '@/lib/money/money';

/** Formats amounts in the report's currency. */
export function moneyFormatter(currencies: readonly CurrencyRecord[], code: string) {
  const currency = currencies.find((item) => item.code === code) ?? { symbol: code, decimals: 2 };
  return (amount: string) => formatMoney(amount, currency);
}

/** Excel takes real numbers, so a sheet can add them up. */
export const asNumber = (value: string) => Number(value);
