import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useFormState, useWatch, type UseFormReturn } from 'react-hook-form';

import { FormField } from '@/components/form/FormField';
import { Button } from '@/components/ui/Button';
import { ICON_BUTTON_CLASS } from '@/components/ui/buttonStyles';
import { Card, CardHeader } from '@/components/ui/Card';
import { Segmented, Switch } from '@/components/ui/Choice';
import { DateInput } from '@/components/ui/DateInput';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatDay, type CalendarMonth } from '@/features/calendar';
import { isConversionAllowed, type ConversionRule, type RoomType } from '@/features/room-types';

import { fewestFree, suggestAllocation, type Supply, type TakenRooms } from '@/features/inventory';
import { nightsBetween } from '@/lib/format/dates';
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
    return label === iso ? 'Not in calendar' : label;
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
  const stayIsUsable = entry.checkIn !== '' && entry.checkOut !== '' && entry.checkOut > entry.checkIn;
  const nights = stayIsUsable ? nightsBetween(entry.checkIn, entry.checkOut) : 0;
  const chosenHotel = hotels.find((hotel) => hotel.id === entry.hotelId);

  /** Rooms still free for this line's stay, across every vendor of its hotel and type. */
  function freeFor(lineIndex: number): number | null {
    const line = entry.lines[lineIndex];
    if (!stayIsUsable || !entry.hotelId || !line?.sourceTypeId) return null;
    const held = [...taken, ...takenByOtherLines(form.getValues(), index, lineIndex)];
    return supplies
      .filter((supply) => supply.hotelId === entry.hotelId && supply.roomTypeId === line.sourceTypeId)
      .reduce((total, supply) => total + fewestFree(supply, entry, held), 0);
  }

  const lineGrid =
    'grid items-start gap-x-3 gap-y-2 grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1.3fr)_2rem]';

  return (
    <Card>
      <CardHeader
        title={chosenHotel?.name ?? `Hotel ${String(index + 1)}`}
        meta={nights > 0 ? `${String(nights)} ${nights === 1 ? 'night' : 'nights'}` : undefined}
        action={
          canRemove && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove hotel ${String(index + 1)}`}
              icon={<Trash2 aria-hidden />}
              onClick={onRemove}
            >
              Remove
            </Button>
          )
        }
        divided
      />
      <div className="space-y-5 p-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
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
            aside={calendarHint(entry.checkIn)}
          >
            {(field) => (
              <DateInput
                {...field}
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
            aside={calendarHint(entry.checkOut)}
          >
            {(field) => (
              <DateInput
                {...field}
                {...checkOutField}
                onChange={(event) => {
                  void checkOutField.onChange(event);
                  suggestAllEmpty();
                }}
              />
            )}
          </FormField>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Segmented
              legend="Rate type"
              options={[
                { value: 'occupancy', label: 'By occupancy' },
                { value: 'flat', label: 'Flat' },
              ]}
              register={form.register(`${path}.rateType`)}
            />
            <Switch label="Rate per night" {...form.register(`${path}.perNight`)} />
            {mealKind !== 'none' && (
              <Switch label="No meals at this hotel" {...form.register(`${path}.noMeals`)} />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {entry.rateType === 'occupancy' ? (
              <>
                <FormField label="Double room rate" required error={entryErrors?.doubleRate?.message}>
                  {(field) => (
                    <Input
                      {...field}
                      inputMode="decimal"
                      className="tabular-nums"
                      {...form.register(`${path}.doubleRate`)}
                    />
                  )}
                </FormField>
                <FormField
                  label="Extra bed rate"
                  error={entryErrors?.extraBedRate?.message}
                  hint="Triple = Double + 1 extra bed, Quad = Double + 2"
                >
                  {(field) => (
                    <Input
                      {...field}
                      inputMode="decimal"
                      className="tabular-nums"
                      {...form.register(`${path}.extraBedRate`)}
                    />
                  )}
                </FormField>
              </>
            ) : (
              <FormField label="Flat rate, every room" required error={entryErrors?.flatRate?.message}>
                {(field) => (
                  <Input
                    {...field}
                    inputMode="decimal"
                    className="tabular-nums"
                    {...form.register(`${path}.flatRate`)}
                  />
                )}
              </FormField>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative overflow-x-auto">
            <div className="min-w-[40rem] space-y-2">
              <div aria-hidden className={`${lineGrid} text-muted text-xs font-medium`}>
                <span>Sold as</span>
                <span>Taken from</span>
                <span>Rooms</span>
                <span>Persons</span>
                <span>Availability</span>
                <span />
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
                  const free = freeFor(lineIndex);
                  const wanted = line && Number.isInteger(line.rooms) && line.rooms > 0 ? line.rooms : 0;
                  const label = (name: string) =>
                    `${name}, hotel ${String(index + 1)} line ${String(lineIndex + 1)}`;
                  return (
                    <li key={field.id} className="space-y-2">
                      <div className={lineGrid}>
                        <FormField
                          label={label('Sold as')}
                          hideLabel
                          required
                          error={lineErrors?.soldAsTypeId?.message}
                        >
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
                          label={label('Taken from')}
                          hideLabel
                          required
                          error={lineErrors?.sourceTypeId?.message}
                        >
                          {(fieldProps) => (
                            <Select
                              {...fieldProps}
                              {...sourceField}
                              className={sources.length <= 1 ? 'text-muted' : undefined}
                              onChange={(event) => {
                                void sourceField.onChange(event);
                                handleSourceChange(lineIndex);
                              }}
                            >
                              {sources.length === 0 && <option value="">Same as sold</option>}
                              {sources.map((type) => (
                                <option key={type.id} value={type.id}>
                                  {type.id === line?.soldAsTypeId ? `${type.name} (same)` : type.name}
                                </option>
                              ))}
                            </Select>
                          )}
                        </FormField>
                        <FormField
                          label={label('Rooms')}
                          hideLabel
                          required
                          error={lineErrors?.rooms?.message}
                        >
                          {(fieldProps) => (
                            <Input
                              {...fieldProps}
                              type="number"
                              min={1}
                              className="tabular-nums"
                              {...roomsField}
                              onBlur={(event) => {
                                void roomsField.onBlur(event);
                                suggestFor(lineIndex, false);
                              }}
                            />
                          )}
                        </FormField>
                        <FormField
                          label={label('Persons per room')}
                          hideLabel
                          required
                          error={lineErrors?.personsPerRoom?.message}
                        >
                          {(fieldProps) => (
                            <Input
                              {...fieldProps}
                              type="number"
                              min={1}
                              className="tabular-nums"
                              {...form.register(`${linePath}.personsPerRoom`, { valueAsNumber: true })}
                            />
                          )}
                        </FormField>
                        <div className="text-meta flex h-(--control-height) items-center" aria-live="polite">
                          {free === null ? (
                            <span className="text-muted">Pick hotel, dates and type</span>
                          ) : wanted > free ? (
                            <span className="text-danger-strong font-medium">
                              {free === 0 ? 'None free' : `Only ${String(free)} free`}
                              <span className="text-danger-strong/80 font-normal">
                                {' '}
                                · {wanted - free} over
                              </span>
                            </span>
                          ) : (
                            <span className="text-success-strong">
                              <span className="font-medium tabular-nums">{free}</span> free these nights
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove line ${String(lineIndex + 1)} of hotel ${String(index + 1)}`}
                          title="Remove line"
                          disabled={lines.fields.length === 1}
                          onClick={() => {
                            lines.remove(lineIndex);
                          }}
                          className={`${ICON_BUTTON_CLASS} mt-0.5 disabled:pointer-events-none disabled:opacity-30`}
                        >
                          <Trash2 aria-hidden />
                        </button>
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
            </div>
          </div>

          {rootError && <p className="text-danger-strong text-xs">{rootError}</p>}
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus aria-hidden />}
            onClick={() => {
              lines.append(emptyLine(), { shouldFocus: false });
            }}
          >
            Add room line
          </Button>
        </div>
      </div>
    </Card>
  );
}
