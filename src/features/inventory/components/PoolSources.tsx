import { Link } from 'react-router';

import { RECORD_LINK_CLASS } from '@/components/ui/buttonStyles';
import { formatDay, type CalendarMonth } from '@/features/calendar';

import type { Pool } from '../domain/pools';

interface PoolSourcesProps {
  pool: Pool;
  months: CalendarMonth[];
}

/** The records behind the figures, so anyone can check how a number came about. */
export function PoolSources({ pool, months }: PoolSourcesProps) {
  const range = (checkIn: string, checkOut: string) =>
    `${formatDay(checkIn, months)} to ${formatDay(checkOut, months)}`;

  return (
    <div className="grid gap-6 px-4 pt-3 pb-4 text-sm lg:grid-cols-2">
      <div>
        <h3 className="text-muted text-meta mb-2">Purchases</h3>
        {pool.purchases.length === 0 ? (
          <p className="text-muted">None on this pool.</p>
        ) : (
          <ul className="space-y-1.5">
            {pool.purchases.map((line) => (
              <li key={`${line.purchaseId}-${String(line.rooms)}`} className="text-foreground">
                <Link to={`/purchases/${line.purchaseId}`} className={RECORD_LINK_CLASS}>
                  {line.number}
                </Link>
                : <span className="tabular-nums">{line.rooms}</span> rooms,{' '}
                {range(line.checkIn, line.checkOut)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="text-muted text-meta mb-2">Sales</h3>
        {pool.sales.length === 0 ? (
          <p className="text-muted">None on this pool.</p>
        ) : (
          <ul className="space-y-1.5">
            {pool.sales.map((sale) => (
              <li key={sale.id} className="text-foreground">
                <Link to={`/contracts/${sale.contractId}`} className={RECORD_LINK_CLASS}>
                  {sale.reference}
                </Link>
                : <span className="tabular-nums">{sale.rooms}</span> rooms,{' '}
                {range(sale.checkIn, sale.checkOut)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
