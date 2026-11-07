import { createColumnHelper } from '@tanstack/react-table';

import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { rateOn } from '@/lib/money/money';

import {
  DEFAULT_CURRENCY,
  RATE_BASE_CURRENCY,
  type CurrencyRecord,
  type ExchangeRateRecord,
} from '../api/currency.schemas';

const columnHelper = createColumnHelper<ServerTableFeatures, CurrencyRecord>();

interface CurrencyColumnOptions {
  rates: readonly ExchangeRateRecord[];
  today: string;
  onUpdateRate: (currency: CurrencyRecord) => void;
  onShowHistory: (currency: CurrencyRecord) => void;
  onEdit: (currency: CurrencyRecord) => void;
  onSetEnabled: (currency: CurrencyRecord, enabled: boolean) => void;
}

export function currencyColumns({
  rates,
  today,
  onUpdateRate,
  onShowHistory,
  onEdit,
  onSetEnabled,
}: CurrencyColumnOptions) {
  return columnHelper.columns([
    columnHelper.accessor('code', {
      header: 'Currency',
      enableSorting: false,
      cell: (info) => (
        <span className="flex items-center gap-2 font-medium">
          {info.getValue()}
          {info.getValue() === DEFAULT_CURRENCY && <Badge tone="brand">Default</Badge>}
          {info.getValue() === RATE_BASE_CURRENCY && <Badge>Rate base</Badge>}
        </span>
      ),
    }),
    columnHelper.accessor('symbol', { header: 'Symbol', enableSorting: false }),
    columnHelper.accessor('decimals', {
      enableSorting: false,
      header: () => <span className="block text-end">Decimals</span>,
      cell: (info) => <span className="block text-end tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: 'rate',
      header: () => <span className="block text-end">Rate against PKR</span>,
      cell: (info) => (
        <span className="block text-end tabular-nums">
          {rateOn(rates, info.row.original.code, today)?.rateToPkr ?? 'No rate'}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'since',
      header: 'Since',
      cell: (info) => (
        <span className="tabular-nums">{rateOn(rates, info.row.original.code, today)?.effectiveFrom}</span>
      ),
    }),
    columnHelper.accessor('enabled', {
      header: 'Status',
      enableSorting: false,
      cell: (info) => (info.getValue() ? <Badge tone="success">Enabled</Badge> : <Badge>Disabled</Badge>),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const currency = info.row.original;
        const isBase = currency.code === RATE_BASE_CURRENCY;
        const isLocked = isBase || currency.code === DEFAULT_CURRENCY;
        return (
          <div className="flex flex-wrap gap-1">
            {!isBase && (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Update ${currency.code} rate`}
                onClick={() => {
                  onUpdateRate(currency);
                }}
              >
                Update rate
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              aria-label={`${currency.code} rate history`}
              onClick={() => {
                onShowHistory(currency);
              }}
            >
              History
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Edit ${currency.code}`}
              onClick={() => {
                onEdit(currency);
              }}
            >
              Edit
            </Button>
            {!isLocked && (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${currency.enabled ? 'Disable' : 'Enable'} ${currency.code}`}
                onClick={() => {
                  onSetEnabled(currency, !currency.enabled);
                }}
              >
                {currency.enabled ? 'Disable' : 'Enable'}
              </Button>
            )}
          </div>
        );
      },
    }),
  ]);
}
