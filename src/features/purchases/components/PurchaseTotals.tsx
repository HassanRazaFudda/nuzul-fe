import type { Control } from 'react-hook-form';

import type { CurrencyRecord } from '@/features/currencies';
import { formatMoney } from '@/lib/money/money';

import type { PurchaseFormValues } from './purchase-form.schema';
import { useLivePurchaseTotals } from './use-live-purchase-totals';

const PKR_FORMAT = { symbol: 'PKR', decimals: 2 };

interface PurchaseTotalsProps {
  control: Control<PurchaseFormValues>;
  currencies: readonly CurrencyRecord[];
}

/** The live figures beside the form. */
export function PurchaseTotals({ control, currencies }: PurchaseTotalsProps) {
  const { totals, format, pkr } = useLivePurchaseTotals(control, currencies);

  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 px-4 pb-4 text-sm">
      <dt className="text-muted">Nights</dt>
      <dd className="text-foreground text-end tabular-nums">{totals.nights}</dd>
      <dt className="text-muted">Room-nights</dt>
      <dd className="text-foreground text-end tabular-nums">{totals.roomNights.toLocaleString('en-GB')}</dd>
      <dt className="text-muted">Room cost</dt>
      <dd className="text-foreground text-end tabular-nums">{formatMoney(totals.roomCost, format)}</dd>
      {totals.mealCost !== (0).toFixed(format.decimals) && (
        <>
          <dt className="text-muted">Meal cost</dt>
          <dd className="text-foreground text-end tabular-nums">{formatMoney(totals.mealCost, format)}</dd>
        </>
      )}
      {totals.mealMaximum !== null && (
        <>
          <dt className="text-muted text-xs">Meal, at most (not in the total)</dt>
          <dd className="text-muted text-end text-xs tabular-nums">
            {formatMoney(totals.mealMaximum, format)}
          </dd>
        </>
      )}
      <dt className="border-border text-foreground mt-1 border-t pt-3 font-semibold">Total</dt>
      <dd className="border-border text-foreground mt-1 border-t pt-3 text-end text-base font-semibold tabular-nums">
        {formatMoney(totals.total, format)}
      </dd>
      <dt className="text-muted">In PKR</dt>
      <dd className="text-muted text-end tabular-nums">{formatMoney(pkr, PKR_FORMAT)}</dd>
    </dl>
  );
}
