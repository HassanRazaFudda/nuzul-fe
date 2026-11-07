import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useFormState } from 'react-hook-form';

import { FormDialog } from '@/components/form/FormDialog';
import { FormField } from '@/components/form/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DEFAULT_CURRENCY, type CurrencyRecord } from '@/features/currencies';

import type { City, Hotel } from '../api/hotel.schemas';
import { AddCity } from './AddCity';
import { hotelFormSchema, type HotelFormValues } from './hotel-form.schema';

const LABELS = {
  name: 'Hotel name',
  city: 'City',
  flatRate: 'Flat rate',
  doubleRate: 'Double room rate',
  extraBedRate: 'Extra bed rate',
};

interface HotelFormProps {
  hotel: Hotel | null;
  cities: readonly City[];
  currencies: readonly CurrencyRecord[];
  onSave: (values: HotelFormValues) => Promise<void>;
  onClose: () => void;
}

export function HotelForm({ hotel, cities, currencies, onSave, onClose }: HotelFormProps) {
  const form = useForm<HotelFormValues>({
    resolver: zodResolver(hotelFormSchema),
    mode: 'onTouched',
    defaultValues: {
      name: hotel?.name ?? '',
      city: hotel?.city ?? '',
      rateCurrency: hotel?.rateCurrency ?? DEFAULT_CURRENCY,
      flatRate: hotel?.flatRate ?? '',
      doubleRate: hotel?.doubleRate ?? '',
      extraBedRate: hotel?.extraBedRate ?? '',
    },
  });
  const { errors } = useFormState({ control: form.control });

  return (
    <FormDialog
      form={form}
      labels={LABELS}
      title={hotel ? `Edit ${hotel.name}` : 'Add hotel'}
      onClose={onClose}
      onValid={onSave}
    >
      <FormField label="Hotel name" required error={errors.name?.message}>
        {(field) => <Input {...field} {...form.register('name')} />}
      </FormField>

      <div>
        <FormField label="City" required error={errors.city?.message}>
          {(field) => (
            // Controlled, so a city added just now is selected as soon as its option exists.
            <Controller
              control={form.control}
              name="city"
              render={({ field: controlled }) => (
                <Select {...field} {...controlled}>
                  <option value="">Choose a city</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                </Select>
              )}
            />
          )}
        </FormField>
        <AddCity
          cities={cities}
          onAdded={(name) => {
            form.setValue('city', name, { shouldDirty: true, shouldValidate: true });
          }}
        />
      </div>

      <fieldset className="rounded-card border-border border p-4">
        <legend className="text-foreground px-1 text-sm font-medium">Reference rates (optional)</legend>
        <p className="text-muted mb-3 text-xs">
          These only pre-fill new contracts. The real cost is on each purchase, and the real price on each
          contract. A rate left blank is simply not offered.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Currency">
            {(field) => (
              <Select {...field} {...form.register('rateCurrency')}>
                {currencies
                  .filter((currency) => currency.enabled)
                  .map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code}
                    </option>
                  ))}
              </Select>
            )}
          </FormField>
          <FormField label="Flat rate" error={errors.flatRate?.message}>
            {(field) => <Input {...field} inputMode="decimal" {...form.register('flatRate')} />}
          </FormField>
          <FormField label="Double room rate" error={errors.doubleRate?.message}>
            {(field) => <Input {...field} inputMode="decimal" {...form.register('doubleRate')} />}
          </FormField>
          <FormField label="Extra bed rate" error={errors.extraBedRate?.message}>
            {(field) => <Input {...field} inputMode="decimal" {...form.register('extraBedRate')} />}
          </FormField>
        </div>
      </fieldset>
    </FormDialog>
  );
}
