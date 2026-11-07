import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFormState } from 'react-hook-form';

import { FormDialog } from '@/components/form/FormDialog';
import { FormField } from '@/components/form/FormField';
import { Input } from '@/components/ui/Input';

import type { CurrencyRecord } from '../api/currency.schemas';
import { currencyFormSchema, type CurrencyFormInput, type CurrencyFormOutput } from './currency-form.schema';

const LABELS = {
  code: 'Code',
  symbol: 'Symbol',
  decimals: 'Decimals',
  rateToPkr: 'Rate against PKR',
};

interface CurrencyFormProps {
  currency: CurrencyRecord | null;
  takenCodes: readonly string[];
  onSave: (values: CurrencyFormOutput) => Promise<void>;
  onClose: () => void;
}

export function CurrencyForm({ currency, takenCodes, onSave, onClose }: CurrencyFormProps) {
  const isAdding = currency === null;
  const form = useForm<CurrencyFormInput, unknown, CurrencyFormOutput>({
    resolver: zodResolver(
      currencyFormSchema.superRefine((values, ctx) => {
        if (!isAdding) return;
        if (takenCodes.includes(values.code)) {
          ctx.addIssue({ code: 'custom', path: ['code'], message: 'This currency already exists' });
        }
        if (values.rateToPkr === '') {
          ctx.addIssue({ code: 'custom', path: ['rateToPkr'], message: 'A new currency needs a rate' });
        }
      }),
    ),
    mode: 'onTouched',
    defaultValues: {
      code: currency?.code ?? '',
      symbol: currency?.symbol ?? '',
      decimals: currency?.decimals ?? 2,
      rateToPkr: '',
    },
  });
  const { errors } = useFormState({ control: form.control });

  return (
    <FormDialog
      form={form}
      labels={LABELS}
      title={currency ? `Edit ${currency.code}` : 'Add currency'}
      onClose={onClose}
      onValid={onSave}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Code" required error={errors.code?.message}>
          {(field) => <Input {...field} readOnly={!isAdding} {...form.register('code')} />}
        </FormField>
        <FormField label="Symbol" required error={errors.symbol?.message}>
          {(field) => <Input {...field} {...form.register('symbol')} />}
        </FormField>
        <FormField label="Decimals" required error={errors.decimals?.message}>
          {(field) => (
            <Input
              {...field}
              type="number"
              min={0}
              max={4}
              {...form.register('decimals', { valueAsNumber: true })}
            />
          )}
        </FormField>
      </div>
      {isAdding && (
        <FormField
          label="Rate against PKR"
          required
          error={errors.rateToPkr?.message}
          hint="PKR for 1 unit of this currency"
        >
          {(field) => <Input {...field} inputMode="decimal" {...form.register('rateToPkr')} />}
        </FormField>
      )}
    </FormDialog>
  );
}
