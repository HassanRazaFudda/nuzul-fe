import { Dialog } from '@/components/ui/Dialog';

import type { CurrencyRecord, ExchangeRateRecord } from '../api/currency.schemas';

interface RateHistoryDialogProps {
  currency: CurrencyRecord | null;
  rates: readonly ExchangeRateRecord[];
  onClose: () => void;
}

export function RateHistoryDialog({ currency, rates, onClose }: RateHistoryDialogProps) {
  const rows = rates
    .filter((rate) => rate.currencyCode === currency?.code)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

  return (
    <Dialog open={currency !== null} onClose={onClose} title={`${currency?.code ?? ''} rate history`}>
      <table className="w-full text-sm">
        <caption className="sr-only">Rate history, newest first</caption>
        <thead>
          <tr className="text-muted text-xs">
            <th scope="col" className="py-1 text-start font-semibold">
              Applies from
            </th>
            <th scope="col" className="py-1 text-end font-semibold">
              PKR for 1 {currency?.code}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((rate) => (
            <tr key={rate.id} className="border-border text-foreground border-t">
              <td className="py-1.5 tabular-nums">{rate.effectiveFrom}</td>
              <td className="py-1.5 text-end tabular-nums">{rate.rateToPkr}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}
