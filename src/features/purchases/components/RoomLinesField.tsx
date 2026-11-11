import { Plus, Trash2 } from 'lucide-react';
import { useFormState, useWatch, type UseFieldArrayReturn, type UseFormReturn } from 'react-hook-form';

import { FormField } from '@/components/form/FormField';
import { Button } from '@/components/ui/Button';
import { ICON_BUTTON_CLASS } from '@/components/ui/buttonStyles';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { RoomType } from '@/features/room-types';
import { cn } from '@/lib/cn';
import { formatAmount } from '@/lib/money/money';

import { emptyLine, type PurchaseFormValues } from './purchase-form.schema';

const ZERO_RATE = /^0*(\.0*)?$/;
const isZeroRate = (rate: string | undefined) => rate !== undefined && rate !== '' && ZERO_RATE.test(rate);

interface RoomLinesFieldProps {
  form: UseFormReturn<PurchaseFormValues>;
  lines: UseFieldArrayReturn<PurchaseFormValues, 'lines'>;
  roomTypes: readonly RoomType[];
  /** Called after a line's room type changes, to pre-fill what depends on it. */
  onRoomTypeChange: (index: number, roomTypeId: string) => void;
  /** Each line's cost as the form stands, in the purchase's currency. */
  lineCosts: readonly string[];
  decimals: number;
}

/**
 * Room lines as rows under one header, so three lines read as a small table instead of three
 * stacked forms. Each row shows its own cost as it is typed.
 */
export function RoomLinesField({
  form,
  lines,
  roomTypes,
  onRoomTypeChange,
  lineCosts,
  decimals,
}: RoomLinesFieldProps) {
  const { errors } = useFormState({ control: form.control });
  const sameRate = useWatch({ control: form.control, name: 'sameRate' });
  const sharedRate = useWatch({ control: form.control, name: 'sharedRate' });
  const mealPricing = useWatch({ control: form.control, name: 'mealPricing' });
  const watched = useWatch({ control: form.control, name: 'lines' });
  const hasZeroRate = sameRate ? isZeroRate(sharedRate) : watched.some((line) => isZeroRate(line.rate));
  const rootError = errors.lines?.root?.message ?? errors.lines?.message;
  const showPersons = mealPricing === 'separate';
  const grid = cn(
    'grid items-start gap-x-3 gap-y-2',
    showPersons
      ? 'grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_2rem]'
      : 'grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_2rem]',
  );

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

      <div className="relative overflow-x-auto">
        <div className="min-w-[34rem] space-y-2">
          <div aria-hidden className={cn(grid, 'text-muted text-xs font-medium')}>
            <span>Room type</span>
            <span>Rooms</span>
            <span>{sameRate ? '' : 'Cost rate'}</span>
            {showPersons && <span>Persons</span>}
            <span className="text-end">Line cost</span>
            <span />
          </div>
          <ul className="space-y-2">
            {lines.fields.map((line, index) => {
              const lineErrors = errors.lines?.[index];
              const roomType = form.register(`lines.${index}.roomTypeId`);
              const cost = lineCosts[index] ?? '0';
              return (
                <li key={line.id} className={grid}>
                  <FormField
                    label={`Room type, line ${String(index + 1)}`}
                    hideLabel
                    required
                    error={lineErrors?.roomTypeId?.message}
                  >
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
                  <FormField
                    label={`Rooms, line ${String(index + 1)}`}
                    hideLabel
                    required
                    error={lineErrors?.rooms?.message}
                  >
                    {(field) => (
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        className="tabular-nums"
                        {...form.register(`lines.${index}.rooms`, { valueAsNumber: true })}
                      />
                    )}
                  </FormField>
                  {sameRate ? (
                    <span className="text-muted text-meta flex h-(--control-height) items-center">
                      Shared rate
                    </span>
                  ) : (
                    <FormField
                      label={`Cost rate, line ${String(index + 1)}`}
                      hideLabel
                      required
                      error={lineErrors?.rate?.message}
                    >
                      {(field) => (
                        <Input
                          {...field}
                          inputMode="decimal"
                          className="tabular-nums"
                          {...form.register(`lines.${index}.rate`)}
                        />
                      )}
                    </FormField>
                  )}
                  {showPersons && (
                    <FormField
                      label={`Persons per room, line ${String(index + 1)}`}
                      hideLabel
                      required
                      error={lineErrors?.personsPerRoom?.message}
                    >
                      {(field) => (
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          className="tabular-nums"
                          {...form.register(`lines.${index}.personsPerRoom`, { valueAsNumber: true })}
                        />
                      )}
                    </FormField>
                  )}
                  <span className="text-foreground flex h-(--control-height) items-center justify-end text-sm tabular-nums">
                    {formatAmount(cost, decimals)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove line ${String(index + 1)}`}
                    title="Remove line"
                    disabled={lines.fields.length === 1}
                    onClick={() => {
                      lines.remove(index);
                    }}
                    className={cn(
                      ICON_BUTTON_CLASS,
                      'mt-0.5 disabled:pointer-events-none disabled:opacity-30',
                    )}
                  >
                    <Trash2 aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {rootError && <p className="text-danger-strong text-xs">{rootError}</p>}
      {hasZeroRate && (
        <p className="text-warning-strong text-xs">
          A cost rate of zero means these rooms cost nothing. Check this is a complimentary room.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus aria-hidden />}
          onClick={() => {
            lines.append(emptyLine(), { shouldFocus: true });
          }}
        >
          Add room line
        </Button>
        <label className="text-secondary hover:text-foreground text-meta flex cursor-pointer items-center gap-2">
          <input type="checkbox" className="size-3.5" {...form.register('sameRate')} />
          Same rate for all lines
        </label>
      </div>
    </div>
  );
}
