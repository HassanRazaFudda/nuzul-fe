import { useWatch, type Control } from 'react-hook-form';

import type { CurrencyRecord } from '@/features/currencies';
import { nightsBetween } from '@/lib/format/dates';
import { moneyLine } from '@/lib/money/money';

import { purchaseTotals } from '../domain/purchase-totals';
import type { PurchaseFormValues } from './purchase-form.schema';

const NUMBER = /^\d+(\.\d+)?$/;

/** While typing, an unfinished figure counts as nothing, so the totals never throw. */
const usableRate = (rate: string | undefined) => (rate && NUMBER.test(rate) ? rate : '0');
const usableCount = (count: number | undefined) =>
  count !== undefined && Number.isInteger(count) && count > 0 ? count : 0;

function usableNights(checkIn: string | undefined, checkOut: string | undefined) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(nightsBetween(checkIn, checkOut), 0);
}

/** The live figures of the form as it stands. The saved ones are worked out again on save. */
export function useLivePurchaseTotals(
  control: Control<PurchaseFormValues>,
  currencies: readonly CurrencyRecord[],
) {
  const values = useWatch({ control });
  const code = values.currencyCode ?? '';
  const format = currencies.find((currency) => currency.code === code) ?? { symbol: code, decimals: 2 };
  const totals = purchaseTotals(
    {
      nights: usableNights(values.checkIn, values.checkOut),
      perNight: values.perNight ?? true,
      lines: (values.lines ?? []).map((line) => ({
        rooms: usableCount(line.rooms),
        rate: usableRate(values.sameRate ? values.sharedRate : line.rate),
        personsPerRoom: usableCount(line.personsPerRoom),
      })),
      meal:
        values.mealPricing === 'separate'
          ? {
              pricing: 'separate',
              rate: usableRate(values.mealRate),
              basis: values.mealBasis ?? 'perPersonPerNight',
              chargeBasis: values.chargeBasis ?? 'fullCapacity',
            }
          : { pricing: 'none' },
    },
    format.decimals,
  );
  const pkr = moneyLine(totals.total, code, usableRate(values.rateToPkr)).amountPkr;
  return { totals, format, pkr, code, rateToPkr: values.rateToPkr ?? '' };
}
