import { useWatch, type Control } from 'react-hook-form';

import type { CurrencyRecord } from '@/features/currencies';
import { nightsBetween } from '@/lib/format/dates';
import { formatMoney, moneyLine } from '@/lib/money/money';

import { purchaseTotals } from '../domain/purchase-totals';
import type { PurchaseFormValues } from './purchase-form.schema';

const NUMBER = /^\d+(\.\d+)?$/;
const PKR_FORMAT = { symbol: 'PKR', decimals: 2 };

/** While typing, an unfinished figure counts as nothing, so the totals never throw. */
const usableRate = (rate: string | undefined) => (rate && NUMBER.test(rate) ? rate : '0');
const usableCount = (count: number | undefined) =>
  count !== undefined && Number.isInteger(count) && count > 0 ? count : 0;

function usableNights(checkIn: string | undefined, checkOut: string | undefined) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(nightsBetween(checkIn, checkOut), 0);
}

interface PurchaseTotalsProps {
  control: Control<PurchaseFormValues>;
  currencies: readonly CurrencyRecord[];
}

/** The live figures beside the form. The saved ones are worked out again on save. */
export function PurchaseTotals({ control, currencies }: PurchaseTotalsProps) {
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

  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 p-5 text-sm">
      <dt className="text-muted">Nights</dt>
      <dd className="text-foreground text-end tabular-nums">{totals.nights}</dd>
      <dt className="text-muted">Room-nights</dt>
      <dd className="text-foreground text-end tabular-nums">{totals.roomNights}</dd>
      <dt className="text-muted">Room cost</dt>
      <dd className="text-foreground text-end tabular-nums">{formatMoney(totals.roomCost, format)}</dd>
      <dt className="text-muted">Meal cost</dt>
      <dd className="text-foreground text-end tabular-nums">{formatMoney(totals.mealCost, format)}</dd>
      {totals.mealMaximum !== null && (
        <>
          <dt className="text-muted text-xs">Meal, at most (not in the total)</dt>
          <dd className="text-muted text-end text-xs tabular-nums">
            {formatMoney(totals.mealMaximum, format)}
          </dd>
        </>
      )}
      <dt className="border-border text-foreground border-t pt-2 font-semibold">Total</dt>
      <dd className="border-border text-foreground border-t pt-2 text-end font-semibold tabular-nums">
        {formatMoney(totals.total, format)}
      </dd>
      <dt className="text-muted">In PKR</dt>
      <dd className="text-muted text-end tabular-nums">{formatMoney(pkr, PKR_FORMAT)}</dd>
    </dl>
  );
}
