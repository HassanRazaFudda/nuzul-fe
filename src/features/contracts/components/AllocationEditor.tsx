import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useFormState, useWatch, type UseFormReturn } from 'react-hook-form';

import { FormField } from '@/components/form/FormField';
import { Button } from '@/components/ui/Button';
import { ICON_BUTTON_CLASS } from '@/components/ui/buttonStyles';
import { DateInput } from '@/components/ui/DateInput';
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
  const [isOpen, setIsOpen] = useState(false);

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

  const hasRowProblem =
    Boolean(rowErrors) || line.allocations.some((row) => row.purchaseId === '' || !(row.rooms > 0));
  const isExpanded = isOpen || hasRowProblem;
  const supplyOf = (purchaseId: string) => supplies.find((supply) => supply.purchaseId === purchaseId);
  const isWholeStay = (row: { checkIn: string; checkOut: string }) =>
    row.checkIn === entry.checkIn && row.checkOut === entry.checkOut;

  if (!isComplete && line.allocations.length === 0) return null;

  return (
    <div className="rounded-control bg-surface-raised border-border-subtle space-y-2 border px-3 py-2">
      {!isExpanded ? (
        <div className="text-meta flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="text-secondary min-w-0">
            <span className="text-muted">From </span>
            {line.allocations.length === 0 ? (
              <span className="text-warning-strong">no vendor yet</span>
            ) : (
              line.allocations.map((row, index) => {
                const supply = supplyOf(row.purchaseId);
                return (
                  <span key={`${row.purchaseId}-${row.checkIn}`}>
                    {index > 0 && <span className="text-muted">, </span>}
                    <span className="text-foreground">{supply?.vendorName ?? 'a purchase'}</span>{' '}
                    <span className="font-mono text-xs">{supply?.number}</span>{' '}
                    <span className="tabular-nums">
                      ({row.rooms} {row.rooms === 1 ? 'room' : 'rooms'}
                      {isWholeStay(row)
                        ? ''
                        : `, ${formatDay(row.checkIn, months)} to ${formatDay(row.checkOut, months)}`}
                      )
                    </span>
                  </span>
                );
              })
            )}
          </p>
          <button
            type="button"
            disabled={!isComplete}
            onClick={() => {
              setIsOpen(true);
            }}
            className="text-secondary hover:text-foreground shrink-0 font-medium underline-offset-2 hover:underline disabled:opacity-40"
          >
            Change vendors
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-foreground text-xs font-semibold">Vendors for these rooms</p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={!isComplete}
                icon={<RotateCcw aria-hidden />}
                onClick={onSuggest}
              >
                Suggest again
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!isComplete || candidates.length === 0}
                icon={<Plus aria-hidden />}
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
              {!hasRowProblem && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsOpen(false);
                  }}
                >
                  Done
                </Button>
              )}
            </div>
          </div>

          {allocations.fields.length > 0 && (
            <div
              aria-hidden
              className="text-muted grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_2rem] gap-2 text-xs font-medium"
            >
              <span>Purchase</span>
              <span>From</span>
              <span>Until</span>
              <span>Rooms</span>
              <span />
            </div>
          )}
          {allocations.fields.map((field, index) => {
            const rowError = rowErrors?.[index];
            const row = line.allocations[index];
            return (
              <div
                key={field.id}
                className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_2rem] items-start gap-2"
              >
                <FormField
                  label={`Vendor, row ${String(index + 1)}`}
                  hideLabel
                  error={rowError?.purchaseId?.message}
                >
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
                      {row?.purchaseId &&
                        !candidates.some((supply) => supply.purchaseId === row.purchaseId) && (
                          <option value={row.purchaseId}>No longer fits this line</option>
                        )}
                    </Select>
                  )}
                </FormField>
                <FormField
                  label={`From, row ${String(index + 1)}`}
                  hideLabel
                  error={rowError?.checkIn?.message}
                >
                  {(fieldProps) => (
                    <DateInput {...fieldProps} {...form.register(`${name}.${index}.checkIn`)} />
                  )}
                </FormField>
                <FormField
                  label={`Until, row ${String(index + 1)}`}
                  hideLabel
                  error={rowError?.checkOut?.message}
                >
                  {(fieldProps) => (
                    <DateInput {...fieldProps} {...form.register(`${name}.${index}.checkOut`)} />
                  )}
                </FormField>
                <FormField
                  label={`Vendor rooms, row ${String(index + 1)}`}
                  hideLabel
                  error={rowError?.rooms?.message}
                >
                  {(fieldProps) => (
                    <Input
                      {...fieldProps}
                      type="number"
                      min={1}
                      className="tabular-nums"
                      {...form.register(`${name}.${index}.rooms`, { valueAsNumber: true })}
                    />
                  )}
                </FormField>
                <button
                  type="button"
                  aria-label={`Remove vendor ${String(index + 1)}`}
                  title="Remove vendor"
                  onClick={() => {
                    allocations.remove(index);
                  }}
                  className={`${ICON_BUTTON_CLASS} mt-0.5`}
                >
                  <Trash2 aria-hidden />
                </button>
              </div>
            );
          })}
        </>
      )}

      {unallocated.map((block) => (
        <p key={block.checkIn} className="text-warning-strong text-meta">
          {block.rooms} {block.rooms === 1 ? 'room has' : 'rooms have'} no vendor,{' '}
          {formatDay(block.checkIn, months)} to {formatDay(block.checkOut, months)}. The contract can still be
          saved.
        </p>
      ))}
    </div>
  );
}
