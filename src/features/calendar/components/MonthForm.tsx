import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFormState } from 'react-hook-form';

import { FormDialog } from '@/components/form/FormDialog';
import { FormField } from '@/components/form/FormField';
import { Input } from '@/components/ui/Input';

import type { CalendarMonth } from '../domain/calendar';
import { monthFormSchema, type MonthFormValues } from './month-form.schema';

const LABELS = {
  cycle: 'Year or cycle',
  ordinal: 'Month number',
  name: 'Month name',
  days: 'Days',
  startDate: 'First day (English date)',
};

interface MonthFormProps {
  month: CalendarMonth | null;
  defaults: Partial<MonthFormValues>;
  /** "cycle/number" of the other months. */
  taken: readonly string[];
  onSave: (values: MonthFormValues) => Promise<void>;
  onClose: () => void;
}

export function MonthForm({ month, defaults, taken, onSave, onClose }: MonthFormProps) {
  const form = useForm<MonthFormValues>({
    resolver: zodResolver(
      monthFormSchema.refine((values) => !taken.includes(`${values.cycle}/${String(values.ordinal)}`), {
        path: ['ordinal'],
        message: 'This year already has a month with this number',
      }),
    ),
    mode: 'onTouched',
    defaultValues: month ?? { name: '', ...defaults },
  });
  const { errors } = useFormState({ control: form.control });

  return (
    <FormDialog
      form={form}
      labels={LABELS}
      title={month ? `Edit ${month.name} ${month.cycle}` : 'Add month'}
      onClose={onClose}
      onValid={onSave}
    >
      {month && (
        <p className="text-muted text-xs">
          Changing a month changes how dates read. Bookings stay on the same nights.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Month name" required error={errors.name?.message}>
          {(field) => <Input {...field} placeholder="Muharram" {...form.register('name')} />}
        </FormField>
        <FormField label="Year or cycle" required error={errors.cycle?.message}>
          {(field) => <Input {...field} placeholder="1449" {...form.register('cycle')} />}
        </FormField>
        <FormField label="Month number" required error={errors.ordinal?.message}>
          {(field) => (
            <Input {...field} type="number" min={1} {...form.register('ordinal', { valueAsNumber: true })} />
          )}
        </FormField>
        <FormField label="Days" required error={errors.days?.message}>
          {(field) => (
            <Input {...field} type="number" min={1} {...form.register('days', { valueAsNumber: true })} />
          )}
        </FormField>
        <FormField
          label="First day (English date)"
          required
          error={errors.startDate?.message}
          className="sm:col-span-2"
        >
          {(field) => <Input {...field} type="date" {...form.register('startDate')} />}
        </FormField>
      </div>
    </FormDialog>
  );
}
