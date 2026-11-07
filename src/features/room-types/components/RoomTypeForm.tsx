import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFormState } from 'react-hook-form';
import { z } from 'zod';

import { FormDialog } from '@/components/form/FormDialog';
import { FormField } from '@/components/form/FormField';
import { Input } from '@/components/ui/Input';
import { requiredText, wholeNumber } from '@/lib/forms/fields';

import type { RoomType } from '../domain/conversion';

const MAX_GUESTS_PER_ROOM = 20;

const roomTypeFormSchema = z.object({
  name: requiredText('room type name', 40),
  capacity: wholeNumber('number of guests', 1, MAX_GUESTS_PER_ROOM),
});
export type RoomTypeFormValues = z.infer<typeof roomTypeFormSchema>;

const LABELS = { name: 'Name', capacity: 'Guests per room' };

interface RoomTypeFormProps {
  roomType: RoomType | null;
  takenNames: readonly string[];
  onSave: (values: RoomTypeFormValues) => Promise<void>;
  onClose: () => void;
}

export function RoomTypeForm({ roomType, takenNames, onSave, onClose }: RoomTypeFormProps) {
  const form = useForm<RoomTypeFormValues>({
    resolver: zodResolver(
      roomTypeFormSchema.refine((values) => !takenNames.includes(values.name.toLowerCase()), {
        path: ['name'],
        message: 'This room type already exists',
      }),
    ),
    mode: 'onTouched',
    defaultValues: roomType ?? { name: '' },
  });
  const { errors } = useFormState({ control: form.control });

  return (
    <FormDialog
      form={form}
      labels={LABELS}
      title={roomType ? `Edit ${roomType.name}` : 'Add room type'}
      onClose={onClose}
      onValid={onSave}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name" required error={errors.name?.message}>
          {(field) => <Input {...field} placeholder="Quint" {...form.register('name')} />}
        </FormField>
        <FormField
          label="Guests per room"
          required
          error={errors.capacity?.message}
          hint="Sets the default on sales, and which conversions make sense"
        >
          {(field) => (
            <Input {...field} type="number" min={1} {...form.register('capacity', { valueAsNumber: true })} />
          )}
        </FormField>
      </div>
    </FormDialog>
  );
}
