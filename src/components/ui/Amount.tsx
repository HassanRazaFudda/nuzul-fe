import { formatAmount, type DecimalLike } from '@/lib/money/money';

interface AmountProps {
  amount: DecimalLike;
  currency: { symbol: string; decimals: number };
}

/** "SAR 1,234.50" with the code quiet, so a column of figures reads as figures. */
export function Amount({ amount, currency }: AmountProps) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className="text-muted text-xs">{currency.symbol}</span> {formatAmount(amount, currency.decimals)}
    </span>
  );
}
