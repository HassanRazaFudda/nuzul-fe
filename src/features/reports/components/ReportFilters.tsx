import type { ReactNode } from 'react';

import { FormField } from '@/components/form/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { CurrencyRecord } from '@/features/currencies';
import type { Hotel } from '@/features/hotels';

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
  children?: ReactNode;
}

/** The filters every report shares. Each change goes straight into the URL. */
export function ReportFilters({
  params,
  onChange,
  hotels,
  currencies,
  periodLabel,
  showHotel = true,
  showPolicy = true,
  children,
}: ReportFiltersProps) {
  return (
    <fieldset className="rounded-card border-border bg-surface grid gap-3 border p-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
      <legend className="text-muted px-1 text-xs font-semibold">Filters</legend>
      <FormField label={`${periodLabel} from`}>
        {(field) => (
          <Input
            {...field}
            type="date"
            value={params.from}
            onChange={(event) => {
              onChange({ from: event.target.value });
            }}
          />
        )}
      </FormField>
      <FormField label="Until (not included)">
        {(field) => (
          <Input
            {...field}
            type="date"
            value={params.to}
            onChange={(event) => {
              onChange({ to: event.target.value });
            }}
          />
        )}
      </FormField>
      {showHotel && (
        <FormField label="Hotel">
          {(field) => (
            <Select
              {...field}
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
        </FormField>
      )}
      <FormField label="Currency">
        {(field) => (
          <Select
            {...field}
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
        )}
      </FormField>
      {showPolicy && (
        <>
          <FormField label="Exchange rates">
            {(field) => (
              <Select
                {...field}
                value={params.policy}
                onChange={(event) => {
                  onChange({ policy: event.target.value === 'revaluation' ? 'revaluation' : 'transaction' });
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
    </fieldset>
  );
}
