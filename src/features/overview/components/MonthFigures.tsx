import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { Stat } from '@/components/ui/Stat';
import { profitAndLossQuery } from '@/features/reports';
import { todayIso } from '@/lib/format/dates';
import { formatMoney } from '@/lib/money/money';

const CURRENCY = 'SAR';
const SAR_FORMAT = { symbol: CURRENCY, decimals: 2 };

/** This calendar month's stays, as on the P&L page: [first of the month, first of the next). */
function thisMonth(today: string) {
  const [year = 0, month = 1] = today.split('-').map(Number);
  const next =
    month === 12 ? `${String(year + 1)}-01-01` : `${String(year)}-${String(month + 1).padStart(2, '0')}-01`;
  return { from: `${today.slice(0, 7)}-01`, to: next };
}

export function MonthFigures() {
  const [today] = useState(() => todayIso(new Date()));
  const range = thisMonth(today);
  const { data } = useQuery(
    profitAndLossQuery({ ...range, hotelId: '', currency: CURRENCY, policy: 'transaction', on: today }),
  );
  const search = `from=${range.from}&to=${range.to}`;
  const value = (amount: string | undefined, to: string) =>
    amount === undefined ? (
      '…'
    ) : (
      <Link to={to} className="underline">
        {formatMoney(amount, SAR_FORMAT)}
      </Link>
    );

  return (
    <>
      <Stat
        label="Profit this month"
        value={value(data?.total.profitKnown, `/profit-loss?${search}`)}
        hint={data?.isPartial ? 'Known portion only: some sold nights have no purchase' : 'Stays this month'}
      />
      <Stat
        label="Unsold exposure this month"
        value={value(data?.exposure, `/reports/exposure?${search}`)}
        hint="Purchased nights nobody bought"
      />
    </>
  );
}
