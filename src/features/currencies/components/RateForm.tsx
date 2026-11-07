import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFormState } from 'react-hook-form';

import { FormDialog } from '@/components/form/FormDialog';
import { FormField } from '@/components/form/FormField';
import { Input } from '@/components/ui/Input';

import type { CurrencyRecord, ExchangeRateRecord } from '../api/currency.schemas';
import { rateFormSchema, type RateFormValues } from './currency-form.schema';

const LABELS = { rateToPkr: 'New rate', effectiveFrom: 'Applies from' };

interface RateFormProps {
  currency: CurrencyRecord;
  current: ExchangeRateRecord | null;
  today: string;
  onSave: (values: RateFormValues) => Promise<void>;
  onClose: () => void;
}

export function RateForm({ currency, current, today, onSave, onClose }: RateFormProps) {
  const form = useForm<RateFormValues>({
    resolver: zodResolver(rateFormSchema),
    mode: 'onTouched',
    defaultValues: { rateToPkr: '', effectiveFrom: today },
  });
  const { errors } = useFormState({ control: form.control });

  return (
    <FormDialog
      form={form}
      labels={LABELS}
      title={`Update ${currency.code} rate`}
      submitLabel="Add rate"
      onClose={onClose}
      onValid={onSave}
    >
      <p className="text-muted text-xs">
        {current ? `Currently 1 ${currency.code} = ${current.rateToPkr} PKR. ` : 'No rate yet. '}
        The old rate stays in the history, and records already saved keep the rate they were saved with.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="New rate"
          required
          error={errors.rateToPkr?.message}
          hint={`PKR for 1 ${currency.code}`}
        >
          {(field) => <Input {...field} inputMode="decimal" {...form.register('rateToPkr')} />}
        </FormField>
        <FormField label="Applies from" required error={errors.effectiveFrom?.message}>
          {(field) => <Input {...field} type="date" {...form.register('effectiveFrom')} />}
        </FormField>
      </div>
    </FormDialog>
  );
}
