import { SlidersHorizontal, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { FormField } from '@/components/form/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { CurrencyRecord } from '@/features/currencies';
import type { Hotel } from '@/features/hotels';
import { cn } from '@/lib/cn';

import type { ReportParams } from '../api/report.schemas';

interface ReportFiltersProps {
  params: ReportParams;
  onChange: (patch: Partial<ReportParams>) => void;
  hotels: readonly Hotel[];
  currencies: readonly CurrencyRecord[];
  /** What the dates filter on, such as "Stay nights" or "Contract date". */
  periodLabel: string;
  showHotel?: boolean;
  showPolicy?: boolean;
  /** Filters that change what the report is about, such as Group by. Always in view. */
  primary?: ReactNode;
  /** Narrowing filters, shown under More filters. */
  children?: ReactNode;
}

const COMPACT = 'h-(--control-height-sm) text-meta';

/**
 * The filters every report shares, as one compact bar: the period, the hotel and the currency
 * in view, the rarer ones behind More filters. Each change goes straight into the URL.
 */
export function ReportFilters({
  params,
  onChange,
  hotels,
  currencies,
  periodLabel,
  showHotel = true,
  showPolicy = true,
  primary,
  children,
}: ReportFiltersProps) {
  const hasMore = showPolicy || Boolean(children);
  const [isMoreOpen, setIsMoreOpen] = useState(params.policy === 'revaluation');
  const hasPeriod = params.from !== '' || params.to !== '';

  return (
    <fieldset className="rounded-card border-border bg-surface shadow-raised border print:hidden">
      <legend className="sr-only">Filters</legend>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted text-meta">{periodLabel}</span>
          <Input
            type="date"
            aria-label={`${periodLabel} from`}
            className={cn(COMPACT, 'w-36')}
            value={params.from}
            onChange={(event) => {
              onChange({ from: event.target.value });
            }}
          />
          <span className="text-muted text-meta">to</span>
          <Input
            type="date"
            aria-label={`${periodLabel} before`}
            title="Up to, not including, this date"
            className={cn(COMPACT, 'w-36')}
            value={params.to}
            onChange={(event) => {
              onChange({ to: event.target.value });
            }}
          />
          {hasPeriod ? (
            <button
              type="button"
              aria-label="Clear the period"
              title="Whole season"
              onClick={() => {
                onChange({ from: '', to: '' });
              }}
              className="text-muted hover:bg-surface-muted hover:text-foreground rounded-control p-1"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          ) : (
            <span className="text-muted text-xs">Whole season</span>
          )}
        </div>
        <span aria-hidden className="bg-border hidden h-5 w-px sm:block" />
        {showHotel && (
          <Select
            aria-label="Hotel"
            className={cn(COMPACT, 'w-52')}
            value={params.hotelId}
            onChange={(event) => {
              onChange({ hotelId: event.target.value });
            }}
          >
            <option value="">All hotels</option>
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </Select>
        )}
        {primary}
        <Select
          aria-label="Currency"
          className={cn(COMPACT, 'w-24')}
          value={params.currency}
          onChange={(event) => {
            onChange({ currency: event.target.value });
          }}
        >
          {currencies.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.code}
            </option>
          ))}
        </Select>
        {hasMore && (
          <button
            type="button"
            aria-expanded={isMoreOpen}
            onClick={() => {
              setIsMoreOpen(!isMoreOpen);
            }}
            className={cn(
              'rounded-control text-secondary hover:bg-surface-muted hover:text-foreground text-meta ms-auto inline-flex h-(--control-height-sm) items-center gap-1.5 px-2.5 font-medium transition-colors duration-150',
              isMoreOpen && 'bg-surface-muted text-foreground',
            )}
          >
            <SlidersHorizontal aria-hidden className="size-3.5" />
            More filters
          </button>
        )}
      </div>
      {hasMore && isMoreOpen && (
        <div className="border-border grid gap-3 border-t px-3 py-3 sm:grid-cols-2 lg:grid-cols-4">
          {showPolicy && (
            <>
              <FormField label="Exchange rates">
                {(field) => (
                  <Select
                    {...field}
                    className={COMPACT}
                    value={params.policy}
                    onChange={(event) => {
                      onChange({
                        policy: event.target.value === 'revaluation' ? 'revaluation' : 'transaction',
                      });
                    }}
                  >
                    <option value="transaction">Each line at its own rate</option>
                    <option value="revaluation">Revalue everything on one date</option>
                  </Select>
                )}
              </FormField>
              <FormField label="Rate date" hint="For amounts in another currency">
                {(field) => (
                  <Input
                    {...field}
                    type="date"
                    className={COMPACT}
                    value={params.on}
                    onChange={(event) => {
                      onChange({ on: event.target.value });
                    }}
                  />
                )}
              </FormField>
            </>
          )}
          {children}
        </div>
      )}
    </fieldset>
  );
}
