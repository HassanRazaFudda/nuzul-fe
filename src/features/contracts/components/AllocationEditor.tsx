import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useFieldArray, useFormState, useWatch, type UseFormReturn } from 'react-hook-form';

import { FormField } from '@/components/form/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatDay, type CalendarMonth } from '@/features/calendar';

import { fewestFree, unallocatedBlocks, type Supply, type TakenRooms } from '@/features/inventory';
import { takenByOtherLines, type ContractFormValues } from './contract-form.schema';

const isUsableStay = (checkIn: string, checkOut: string) =>
  checkIn !== '' && checkOut !== '' && checkOut > checkIn;

interface AllocationEditorProps {
  form: UseFormReturn<ContractFormValues>;
  hotelIndex: number;
  lineIndex: number;
  supplies: readonly Supply[];
  taken: readonly TakenRooms[];
  months: CalendarMonth[];
  onSuggest: () => void;
}

/** Whose rooms this line uses. Pre-filled; the user can change it or split it across vendors. */
export function AllocationEditor({
  form,
  hotelIndex,
  lineIndex,
  supplies,
  taken,
  months,
  onSuggest,
}: AllocationEditorProps) {
  const name = `hotels.${hotelIndex}.lines.${lineIndex}.allocations` as const;
  const allocations = useFieldArray({ control: form.control, name });
  const { errors } = useFormState({ control: form.control });
  const hotels = useWatch({ control: form.control, name: 'hotels' });

  const entry = hotels[hotelIndex];
  const line = entry?.lines[lineIndex];
  if (!entry || !line) return null;

  const stayIsUsable = isUsableStay(entry.checkIn, entry.checkOut);
  const candidates = supplies.filter(
    (supply) => supply.hotelId === entry.hotelId && supply.roomTypeId === line.sourceTypeId,
  );
  const held = [...taken, ...takenByOtherLines({ hotels }, hotelIndex, lineIndex)];
  const rowErrors = errors.hotels?.[hotelIndex]?.lines?.[lineIndex]?.allocations;
  const isComplete = stayIsUsable && line.sourceTypeId !== '' && line.rooms > 0;
  const unallocated =
    isComplete && line.allocations.every((row) => isUsableStay(row.checkIn, row.checkOut))
      ? unallocatedBlocks(entry, line.rooms, line.allocations)
      : [];

  return (
    <div className="bg-background rounded-control space-y-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-foreground text-xs font-semibold">Whose rooms</p>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={!isComplete}
            icon={<RotateCcw aria-hidden className="size-3.5" />}
            onClick={onSuggest}
          >
            Suggest again
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!isComplete || candidates.length === 0}
            icon={<Plus aria-hidden className="size-3.5" />}
            onClick={() => {
              allocations.append({
                purchaseId: '',
                checkIn: entry.checkIn,
                checkOut: entry.checkOut,
                rooms: Number.NaN,
              });
            }}
          >
            Add vendor
          </Button>
        </div>
      </div>

      {allocations.fields.map((field, index) => {
        const rowError = rowErrors?.[index];
        const row = line.allocations[index];
        return (
          <div key={field.id} className="grid items-start gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <FormField label="Vendor" error={rowError?.purchaseId?.message}>
              {(fieldProps) => (
                <Select {...fieldProps} {...form.register(`${name}.${index}.purchaseId`)}>
                  <option value="">Choose a purchase</option>
                  {candidates.map((supply) => {
                    // Free on this row's own nights, so a vendor covering only part of the stay
                    // does not read as having none.
                    const nights = row && isUsableStay(row.checkIn, row.checkOut) ? row : entry;
                    const free = stayIsUsable ? fewestFree(supply, nights, held) : 0;
                    return (
                      <option key={supply.purchaseId} value={supply.purchaseId}>
                        {supply.vendorName}, {supply.number} ({free} free)
                      </option>
                    );
                  })}
                  {row?.purchaseId && !candidates.some((supply) => supply.purchaseId === row.purchaseId) && (
                    <option value={row.purchaseId}>No longer fits this line</option>
                  )}
                </Select>
              )}
            </FormField>
            <FormField label="From" error={rowError?.checkIn?.message}>
              {(fieldProps) => (
                <Input {...fieldProps} type="date" {...form.register(`${name}.${index}.checkIn`)} />
              )}
            </FormField>
            <FormField label="Until" error={rowError?.checkOut?.message}>
              {(fieldProps) => (
                <Input {...fieldProps} type="date" {...form.register(`${name}.${index}.checkOut`)} />
              )}
            </FormField>
            <FormField label="Vendor rooms" error={rowError?.rooms?.message}>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="number"
                  min={1}
                  {...form.register(`${name}.${index}.rooms`, { valueAsNumber: true })}
                />
              )}
            </FormField>
            <Button
              variant="ghost"
              size="sm"
              className="sm:mt-6"
              aria-label={`Remove vendor ${String(index + 1)}`}
              icon={<Trash2 aria-hidden className="size-4" />}
              onClick={() => {
                allocations.remove(index);
              }}
            />
          </div>
        );
      })}

      {unallocated.map((block) => (
        <p key={block.checkIn} className="text-warning-strong text-xs">
          {block.rooms} {block.rooms === 1 ? 'room has' : 'rooms have'} no vendor,{' '}
          {formatDay(block.checkIn, months)} to {formatDay(block.checkOut, months)}. The contract can still be
          saved.
        </p>
      ))}
    </div>
  );
}
