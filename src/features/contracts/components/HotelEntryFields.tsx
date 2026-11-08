import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useFormState, useWatch, type UseFormReturn } from 'react-hook-form';

import { FormField } from '@/components/form/FormField';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatDay, type CalendarMonth } from '@/features/calendar';
import { isConversionAllowed, type ConversionRule, type RoomType } from '@/features/room-types';

import { suggestAllocation, type Supply, type TakenRooms } from '@/features/inventory';
import { AllocationEditor } from './AllocationEditor';
import { emptyLine, takenByOtherLines, type ContractFormValues } from './contract-form.schema';

export interface HotelOption {
  id: string;
  name: string;
  rateCurrency?: string | undefined;
  flatRate?: string | undefined;
  doubleRate?: string | undefined;
  extraBedRate?: string | undefined;
}

interface HotelEntryFieldsProps {
  form: UseFormReturn<ContractFormValues>;
  index: number;
  hotels: readonly HotelOption[];
  roomTypes: RoomType[];
  rules: ConversionRule[];
  supplies: readonly Supply[];
  taken: readonly TakenRooms[];
  months: CalendarMonth[];
  canRemove: boolean;
  onRemove: () => void;
}

export function HotelEntryFields({
  form,
  index,
  hotels,
  roomTypes,
  rules,
  supplies,
  taken,
  months,
  canRemove,
  onRemove,
}: HotelEntryFieldsProps) {
  const path = `hotels.${index}` as const;
  const lines = useFieldArray({ control: form.control, name: `${path}.lines` });
  const { errors } = useFormState({ control: form.control });
  const entry = useWatch({ control: form.control, name: path });
  const mealKind = useWatch({ control: form.control, name: 'mealKind' });
  const entryErrors = errors.hotels?.[index];
  const rootError = entryErrors?.lines?.root?.message ?? entryErrors?.lines?.message;

  const calendarHint = (iso: string) => {
    if (!iso) return undefined;
    const label = formatDay(iso, months);
    return label === iso ? 'Outside the calendar' : label;
  };

  /** Fills a line's vendors, unless the user has already chosen some or it is unfinished. */
  function suggestFor(lineIndex: number, replace: boolean) {
    const values = form.getValues();
    const current = values.hotels[index];
    const line = current?.lines[lineIndex];
    if (!current || !line) return;
    if (!replace && line.allocations.length > 0) return;
    const isReady =
      current.hotelId !== '' &&
      current.checkIn !== '' &&
      current.checkOut > current.checkIn &&
      line.sourceTypeId !== '' &&
      line.rooms > 0;
    if (!isReady) return;
    form.setValue(
      `${path}.lines.${lineIndex}.allocations`,
      suggestAllocation(
        {
          hotelId: current.hotelId,
          roomTypeId: line.sourceTypeId,
          checkIn: current.checkIn,
          checkOut: current.checkOut,
          rooms: line.rooms,
        },
        supplies,
        [...taken, ...takenByOtherLines(values, index, lineIndex)],
      ),
      { shouldDirty: true },
    );
  }

  function suggestAllEmpty() {
    form.getValues(`${path}.lines`).forEach((_, lineIndex) => {
      suggestFor(lineIndex, false);
    });
  }

  /** A hotel's reference rates are copied in, so later changes never reach this contract. */
  function handleHotelChange(hotelId: string) {
    const hotel = hotels.find((item) => item.id === hotelId);
    if (hotel?.rateCurrency === form.getValues('currencyCode')) {
      const fill = (field: 'doubleRate' | 'extraBedRate' | 'flatRate', value: string | undefined) => {
        if (value && form.getValues(`${path}.${field}`) === '') {
          form.setValue(`${path}.${field}`, value, { shouldDirty: true });
        }
      };
      fill('doubleRate', hotel.doubleRate);
      fill('extraBedRate', hotel.extraBedRate);
      fill('flatRate', hotel.flatRate);
    }
    suggestAllEmpty();
  }

  function handleSoldAsChange(lineIndex: number, soldAsTypeId: string) {
    const capacity = roomTypes.find((type) => type.id === soldAsTypeId)?.capacity;
    form.setValue(`${path}.lines.${lineIndex}.sourceTypeId`, soldAsTypeId, { shouldDirty: true });
    if (capacity !== undefined) {
      form.setValue(`${path}.lines.${lineIndex}.personsPerRoom`, capacity, { shouldDirty: true });
    }
    form.setValue(`${path}.lines.${lineIndex}.allocations`, [], { shouldDirty: true });
    suggestFor(lineIndex, true);
  }

  function handleSourceChange(lineIndex: number) {
    form.setValue(`${path}.lines.${lineIndex}.allocations`, [], { shouldDirty: true });
    suggestFor(lineIndex, true);
  }

  const hotelField = form.register(`${path}.hotelId`);
  const checkInField = form.register(`${path}.checkIn`);
  const checkOutField = form.register(`${path}.checkOut`);

  return (
    <Card>
      <CardHeader
        title={`Hotel ${String(index + 1)}`}
        subtitle="Nights come from the dates"
        action={
          canRemove && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove hotel ${String(index + 1)}`}
              icon={<Trash2 aria-hidden className="size-4" />}
              onClick={onRemove}
            >
              Remove
            </Button>
          )
        }
      />
      <div className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Hotel" required error={entryErrors?.hotelId?.message}>
            {(field) => (
              <Select
                {...field}
                {...hotelField}
                onChange={(event) => {
                  void hotelField.onChange(event);
                  handleHotelChange(event.target.value);
                }}
              >
                <option value="">Choose a hotel</option>
                {hotels.map((hotel) => (
                  <option key={hotel.id} value={hotel.id}>
                    {hotel.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField
            label="Check-in"
            required
            error={entryErrors?.checkIn?.message}
            hint={calendarHint(entry.checkIn)}
          >
            {(field) => (
              <Input
                {...field}
                type="date"
                {...checkInField}
                onChange={(event) => {
                  void checkInField.onChange(event);
                  suggestAllEmpty();
                }}
              />
            )}
          </FormField>
          <FormField
            label="Check-out"
            required
            error={entryErrors?.checkOut?.message}
            hint={calendarHint(entry.checkOut)}
          >
            {(field) => (
              <Input
                {...field}
                type="date"
                {...checkOutField}
                onChange={(event) => {
                  void checkOutField.onChange(event);
                  suggestAllEmpty();
                }}
              />
            )}
          </FormField>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <label className="text-foreground flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-primary size-4" {...form.register(`${path}.perNight`)} />
            Rate is per night
          </label>
          {mealKind !== 'none' && (
            <label className="text-foreground flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary size-4"
                {...form.register(`${path}.noMeals`)}
              />
              No meals at this hotel
            </label>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Rate type">
            {(field) => (
              <Select {...field} {...form.register(`${path}.rateType`)}>
                <option value="occupancy">By occupancy</option>
                <option value="flat">Flat, one rate for every room</option>
              </Select>
            )}
          </FormField>
          {entry.rateType === 'occupancy' ? (
            <>
              <FormField label="Double room rate" required error={entryErrors?.doubleRate?.message}>
                {(field) => <Input {...field} inputMode="decimal" {...form.register(`${path}.doubleRate`)} />}
              </FormField>
              <FormField
                label="Extra bed rate"
                error={entryErrors?.extraBedRate?.message}
                hint="Triple = Double + 1 extra bed, Quad = Double + 2"
              >
                {(field) => (
                  <Input {...field} inputMode="decimal" {...form.register(`${path}.extraBedRate`)} />
                )}
              </FormField>
            </>
          ) : (
            <FormField label="Flat rate" required error={entryErrors?.flatRate?.message}>
              {(field) => <Input {...field} inputMode="decimal" {...form.register(`${path}.flatRate`)} />}
            </FormField>
          )}
        </div>

        <ul className="space-y-3">
          {lines.fields.map((field, lineIndex) => {
            const linePath = `${path}.lines.${lineIndex}` as const;
            const line = entry.lines[lineIndex];
            const lineErrors = entryErrors?.lines?.[lineIndex];
            const soldAsField = form.register(`${linePath}.soldAsTypeId`);
            const sourceField = form.register(`${linePath}.sourceTypeId`);
            const roomsField = form.register(`${linePath}.rooms`, { valueAsNumber: true });
            const sources = roomTypes.filter(
              (type) =>
                line?.soldAsTypeId &&
                isConversionAllowed(rules, roomTypes, entry.hotelId, type.id, line.soldAsTypeId),
            );
            return (
              <li key={field.id} className="rounded-control border-border space-y-3 border p-3">
                <div className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                  <FormField label="Sold as" required error={lineErrors?.soldAsTypeId?.message}>
                    {(fieldProps) => (
                      <Select
                        {...fieldProps}
                        {...soldAsField}
                        onChange={(event) => {
                          void soldAsField.onChange(event);
                          handleSoldAsChange(lineIndex, event.target.value);
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
                    label="Taken from"
                    required
                    error={lineErrors?.sourceTypeId?.message}
                    hint="The purchased type these rooms come from"
                  >
                    {(fieldProps) => (
                      <Select
                        {...fieldProps}
                        {...sourceField}
                        onChange={(event) => {
                          void sourceField.onChange(event);
                          handleSourceChange(lineIndex);
                        }}
                      >
                        {sources.length === 0 && <option value="">Choose a type first</option>}
                        {sources.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </FormField>
                  <FormField label="Rooms" required error={lineErrors?.rooms?.message}>
                    {(fieldProps) => (
                      <Input
                        {...fieldProps}
                        type="number"
                        min={1}
                        {...roomsField}
                        onBlur={(event) => {
                          void roomsField.onBlur(event);
                          suggestFor(lineIndex, false);
                        }}
                      />
                    )}
                  </FormField>
                  <FormField label="Persons per room" required error={lineErrors?.personsPerRoom?.message}>
                    {(fieldProps) => (
                      <Input
                        {...fieldProps}
                        type="number"
                        min={1}
                        {...form.register(`${linePath}.personsPerRoom`, { valueAsNumber: true })}
                      />
                    )}
                  </FormField>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="sm:mt-6"
                    aria-label={`Remove line ${String(lineIndex + 1)} of hotel ${String(index + 1)}`}
                    disabled={lines.fields.length === 1}
                    icon={<Trash2 aria-hidden className="size-4" />}
                    onClick={() => {
                      lines.remove(lineIndex);
                    }}
                  />
                </div>
                <AllocationEditor
                  form={form}
                  hotelIndex={index}
                  lineIndex={lineIndex}
                  supplies={supplies}
                  taken={taken}
                  months={months}
                  onSuggest={() => {
                    suggestFor(lineIndex, true);
                  }}
                />
              </li>
            );
          })}
        </ul>

        {rootError && <p className="text-danger-strong text-xs">{rootError}</p>}
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus aria-hidden className="size-4" />}
          onClick={() => {
            lines.append(emptyLine(), { shouldFocus: false });
          }}
        >
          Add room line
        </Button>
      </div>
    </Card>
  );
}
