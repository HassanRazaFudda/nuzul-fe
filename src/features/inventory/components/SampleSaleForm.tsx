import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFormState } from 'react-hook-form';
import { z } from 'zod';

import { FormDialog } from '@/components/form/FormDialog';
import { FormField } from '@/components/form/FormField';
import { Input } from '@/components/ui/Input';
import { isoDateField, wholeNumber } from '@/lib/forms/fields';

const MAX_ROOMS = 9999;

const sampleSaleFormSchema = z
  .object({
    checkIn: isoDateField,
    checkOut: isoDateField,
    rooms: wholeNumber('number of rooms', 1, MAX_ROOMS),
  })
  .refine((values) => values.checkOut > values.checkIn, {
    path: ['checkOut'],
    message: 'Check-out must be after check-in',
  });
export type SampleSaleFormValues = z.infer<typeof sampleSaleFormSchema>;

const LABELS = { checkIn: 'Check-in', checkOut: 'Check-out', rooms: 'Rooms' };

interface SampleSaleFormProps {
  poolName: string;
  onSave: (values: SampleSaleFormValues) => Promise<void>;
  onClose: () => void;
}

export function SampleSaleForm({ poolName, onSave, onClose }: SampleSaleFormProps) {
  const form = useForm<SampleSaleFormValues>({
    resolver: zodResolver(sampleSaleFormSchema),
    mode: 'onTouched',
    defaultValues: { checkIn: '', checkOut: '' },
  });
  const { errors } = useFormState({ control: form.control });

  return (
    <FormDialog
      form={form}
      labels={LABELS}
      title={`Add sample sale: ${poolName}`}
      onClose={onClose}
      onValid={onSave}
    >
      <p className="text-muted text-xs">
        For trying out the ledger only. Sales contracts replace this once they are built.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Check-in" required error={errors.checkIn?.message}>
          {(field) => <Input {...field} type="date" {...form.register('checkIn')} />}
        </FormField>
        <FormField label="Check-out" required error={errors.checkOut?.message}>
          {(field) => <Input {...field} type="date" {...form.register('checkOut')} />}
        </FormField>
        <FormField label="Rooms" required error={errors.rooms?.message}>
          {(field) => (
            <Input {...field} type="number" min={1} {...form.register('rooms', { valueAsNumber: true })} />
          )}
        </FormField>
      </div>
    </FormDialog>
  );
}
