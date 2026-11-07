import { Plus, Trash2 } from 'lucide-react';
import { useFormState, useWatch, type UseFieldArrayReturn, type UseFormReturn } from 'react-hook-form';

import { FormField } from '@/components/form/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { RoomType } from '@/features/room-types';

import { emptyLine, type PurchaseFormValues } from './purchase-form.schema';

const ZERO_RATE = /^0*(\.0*)?$/;
const isZeroRate = (rate: string | undefined) => rate !== undefined && rate !== '' && ZERO_RATE.test(rate);

interface RoomLinesFieldProps {
  form: UseFormReturn<PurchaseFormValues>;
  lines: UseFieldArrayReturn<PurchaseFormValues, 'lines'>;
  roomTypes: readonly RoomType[];
  /** Called after a line's room type changes, to pre-fill what depends on it. */
  onRoomTypeChange: (index: number, roomTypeId: string) => void;
}

export function RoomLinesField({ form, lines, roomTypes, onRoomTypeChange }: RoomLinesFieldProps) {
  const { errors } = useFormState({ control: form.control });
  const sameRate = useWatch({ control: form.control, name: 'sameRate' });
  const sharedRate = useWatch({ control: form.control, name: 'sharedRate' });
  const mealPricing = useWatch({ control: form.control, name: 'mealPricing' });
  const watched = useWatch({ control: form.control, name: 'lines' });
  const hasZeroRate = sameRate ? isZeroRate(sharedRate) : watched.some((line) => isZeroRate(line.rate));
  const rootError = errors.lines?.root?.message ?? errors.lines?.message;

  return (
    <div className="space-y-3">
      {sameRate && (
        <FormField
          label="Rate for all lines"
          required
          error={errors.sharedRate?.message}
          className="sm:max-w-xs"
        >
          {(field) => <Input {...field} inputMode="decimal" {...form.register('sharedRate')} />}
        </FormField>
      )}

      <ul className="space-y-3">
        {lines.fields.map((line, index) => {
          const lineErrors = errors.lines?.[index];
          const roomType = form.register(`lines.${index}.roomTypeId`);
          return (
            <li
              key={line.id}
              className="rounded-control border-border grid items-start gap-3 border p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]"
            >
              <FormField label="Room type" required error={lineErrors?.roomTypeId?.message}>
                {(field) => (
                  <Select
                    {...field}
                    {...roomType}
                    onChange={(event) => {
                      void roomType.onChange(event);
                      onRoomTypeChange(index, event.target.value);
                    }}
                  >
                    <option value="">Choose a type</option>
                    {roomTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField label="Rooms" required error={lineErrors?.rooms?.message}>
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    min={1}
                    {...form.register(`lines.${index}.rooms`, { valueAsNumber: true })}
                  />
                )}
              </FormField>
              {!sameRate && (
                <FormField label="Cost rate" required error={lineErrors?.rate?.message}>
                  {(field) => (
                    <Input {...field} inputMode="decimal" {...form.register(`lines.${index}.rate`)} />
                  )}
                </FormField>
              )}
              {mealPricing === 'separate' && (
                <FormField label="Persons per room" required error={lineErrors?.personsPerRoom?.message}>
                  {(field) => (
                    <Input
                      {...field}
                      type="number"
                      min={1}
                      {...form.register(`lines.${index}.personsPerRoom`, { valueAsNumber: true })}
                    />
                  )}
                </FormField>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="sm:mt-6"
                aria-label={`Remove line ${String(index + 1)}`}
                disabled={lines.fields.length === 1}
                icon={<Trash2 aria-hidden className="size-4" />}
                onClick={() => {
                  lines.remove(index);
                }}
              />
            </li>
          );
        })}
      </ul>

      {rootError && <p className="text-danger-strong text-xs">{rootError}</p>}
      {hasZeroRate && (
        <p className="text-warning-strong text-xs">
          A cost rate of zero means these rooms cost nothing. Check this is a complimentary room.
        </p>
      )}
      <Button
        variant="secondary"
        size="sm"
        icon={<Plus aria-hidden className="size-4" />}
        onClick={() => {
          lines.append(emptyLine(), { shouldFocus: true });
        }}
      >
        Add room line
      </Button>
    </div>
  );
}
