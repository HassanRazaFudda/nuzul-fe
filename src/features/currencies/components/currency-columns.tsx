import { createColumnHelper } from '@tanstack/react-table';

import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Menu } from '@/components/ui/Menu';
import { formatIsoDate } from '@/lib/format/dates';
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
        <span className="flex items-baseline gap-2">
          <span className="font-mono font-medium">{info.getValue()}</span>
          {info.getValue() === DEFAULT_CURRENCY && <span className="text-muted text-xs">Default</span>}
          {info.getValue() === RATE_BASE_CURRENCY && <span className="text-muted text-xs">Rate base</span>}
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
      cell: (info) => {
        const since = rateOn(rates, info.row.original.code, today)?.effectiveFrom;
        return since ? <span className="tabular-nums">{formatIsoDate(since)}</span> : null;
      },
    }),
    columnHelper.accessor('enabled', {
      header: 'Status',
      enableSorting: false,
      cell: (info) => (info.getValue() ? <Badge tone="success">Enabled</Badge> : <Badge>Disabled</Badge>),
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: (info) => {
        const currency = info.row.original;
        const isBase = currency.code === RATE_BASE_CURRENCY;
        const isLocked = isBase || currency.code === DEFAULT_CURRENCY;
        return (
          <div className="flex items-center justify-end gap-1">
            {!isBase && (
              <Button
                variant="secondary"
                size="sm"
                aria-label={`Update ${currency.code} rate`}
                onClick={() => {
                  onUpdateRate(currency);
                }}
              >
                Update rate
              </Button>
            )}
            <Menu
              label={`More actions for ${currency.code}`}
              items={[
                {
                  label: 'Rate history',
                  onSelect: () => {
                    onShowHistory(currency);
                  },
                },
                {
                  label: 'Edit',
                  onSelect: () => {
                    onEdit(currency);
                  },
                },
                !isLocked && {
                  label: currency.enabled ? 'Disable' : 'Enable',
                  tone: currency.enabled ? 'danger' : undefined,
                  hint: currency.enabled ? 'No longer offered on new records' : undefined,
                  onSelect: () => {
                    onSetEnabled(currency, !currency.enabled);
                  },
                },
              ]}
            />
          </div>
        );
      },
    }),
  ]);
}
