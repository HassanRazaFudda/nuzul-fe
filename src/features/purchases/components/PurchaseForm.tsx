import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type SubmitEvent } from 'react';
import { useFieldArray, useForm, useFormState, useWatch, type Path } from 'react-hook-form';
import { Link, useBlocker } from 'react-router';

import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { FormErrorSummary } from '@/components/form/FormErrorSummary';
import { FormField } from '@/components/form/FormField';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { formatDay, type CalendarMonth } from '@/features/calendar';
import {
  DEFAULT_CURRENCY,
  RATE_BASE_CURRENCY,
  type CurrencyRecord,
  type ExchangeRateRecord,
} from '@/features/currencies';
import type { Hotel } from '@/features/hotels';
import type { Partner } from '@/features/partners';
import type { RoomType } from '@/features/room-types';
import { getErrorMessage } from '@/lib/api/api-error';
import { rateOn } from '@/lib/money/money';

import type { PurchaseView } from '../api/purchase.schemas';
import { referenceRate } from '../domain/purchase-totals';
import { MealFields } from './MealFields';
import { emptyLine, purchaseFormSchema, toFormValues, type PurchaseFormValues } from './purchase-form.schema';
import { PurchaseTotals } from './PurchaseTotals';
import { RoomLinesField } from './RoomLinesField';

type Labels = Partial<Record<Path<PurchaseFormValues>, string>>;

const STATIC_LABELS: Labels = {
  hotelId: 'Hotel',
  vendorId: 'Vendor',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  currencyCode: 'Currency',
  rateToPkr: 'Rate against PKR',
  sharedRate: 'Rate for all lines',
  mealRate: 'Meal rate',
};

function labelsFor(lineCount: number): Labels {
  const labels: Labels = { ...STATIC_LABELS };
  for (let index = 0; index < lineCount; index++) {
    const line = `Line ${String(index + 1)}`;
    labels[`lines.${index}.roomTypeId`] = `${line}: room type`;
    labels[`lines.${index}.rooms`] = `${line}: rooms`;
    labels[`lines.${index}.rate`] = `${line}: cost rate`;
    labels[`lines.${index}.personsPerRoom`] = `${line}: persons per room`;
  }
  return labels;
}

interface PurchaseFormProps {
  purchase: PurchaseView | null;
  hotels: readonly Hotel[];
  vendors: readonly Partner[];
  roomTypes: readonly RoomType[];
  currencies: readonly CurrencyRecord[];
  rates: readonly ExchangeRateRecord[];
  months: CalendarMonth[];
  today: string;
  cancelTo: string;
  /** Must reject on failure, so the error stays on screen. */
  onSave: (values: PurchaseFormValues) => Promise<void>;
}

export function PurchaseForm({
  purchase,
  hotels,
  vendors,
  roomTypes,
  currencies,
  rates,
  months,
  today,
  cancelTo,
  onSave,
}: PurchaseFormProps) {
  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    mode: 'onTouched',
    defaultValues: purchase
      ? toFormValues(purchase)
      : {
          hotelId: '',
          vendorId: '',
          checkIn: '',
          checkOut: '',
          currencyCode: DEFAULT_CURRENCY,
          rateToPkr: rateOn(rates, DEFAULT_CURRENCY, today)?.rateToPkr ?? '',
          perNight: true,
          sameRate: false,
          sharedRate: '',
          lines: [emptyLine()],
          mealPricing: 'none',
          mealRate: '',
          mealBasis: 'perPersonPerNight',
          chargeBasis: 'fullCapacity',
          notes: '',
        },
  });
  const lines = useFieldArray({ control: form.control, name: 'lines' });
  const { errors, isDirty, isSubmitting } = useFormState({ control: form.control });
  const checkIn = useWatch({ control: form.control, name: 'checkIn' });
  const checkOut = useWatch({ control: form.control, name: 'checkOut' });
  const currencyCode = useWatch({ control: form.control, name: 'currencyCode' });
  const [showSummary, setShowSummary] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  // The save itself navigates away, so leaving while it runs needs no question.
  const blocker = useBlocker(isDirty && !isSubmitting);

  const calendarHint = (iso: string) => {
    if (!iso) return undefined;
    const label = formatDay(iso, months);
    return label === iso ? 'Outside the calendar' : label;
  };

  /** A hotel's reference rates only help when they are in the purchase's currency. */
  function referenceFor(hotelId: string, roomTypeId: string): string {
    const hotel = hotels.find((item) => item.id === hotelId);
    const roomType = roomTypes.find((item) => item.id === roomTypeId);
    if (!hotel || !roomType || hotel.rateCurrency !== form.getValues('currencyCode')) return '';
    return referenceRate(hotel, roomType.capacity);
  }

  function fillEmptyRate(index: number, hotelId: string, roomTypeId: string) {
    if (form.getValues(`lines.${index}.rate`) !== '') return;
    form.setValue(`lines.${index}.rate`, referenceFor(hotelId, roomTypeId), { shouldDirty: true });
  }

  function handleRoomTypeChange(index: number, roomTypeId: string) {
    const capacity = roomTypes.find((type) => type.id === roomTypeId)?.capacity;
    if (capacity !== undefined) {
      form.setValue(`lines.${index}.personsPerRoom`, capacity, { shouldDirty: true });
    }
    fillEmptyRate(index, form.getValues('hotelId'), roomTypeId);
  }

  function handleHotelChange(hotelId: string) {
    form.getValues('lines').forEach((line, index) => {
      fillEmptyRate(index, hotelId, line.roomTypeId);
    });
  }

  function handleCurrencyChange(code: string) {
    form.setValue('rateToPkr', rateOn(rates, code, today)?.rateToPkr ?? '', {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleSubmit(event: SubmitEvent) {
    void form.handleSubmit(
      async (values) => {
        setSaveError(null);
        try {
          await onSave(values);
        } catch (error) {
          setSaveError(error);
        }
      },
      () => {
        setShowSummary(true);
      },
    )(event);
  }

  const hotelField = form.register('hotelId');
  const currencyField = form.register('currencyCode');
  // A record keeps its own hotel, vendor and currency even after they are deactivated.
  const hotelOptions =
    hotels.some((hotel) => hotel.id === purchase?.hotelId) || !purchase
      ? hotels
      : [{ id: purchase.hotelId, name: purchase.hotelName }, ...hotels];
  const vendorOptions =
    vendors.some((vendor) => vendor.id === purchase?.vendorId) || !purchase
      ? vendors
      : [{ id: purchase.vendorId, name: purchase.vendorName }, ...vendors];
  const currencyOptions = currencies.filter(
    (currency) => currency.enabled || currency.code === purchase?.currencyCode,
  );

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5 p-5 lg:p-8">
      {saveError !== null && (
        <ErrorNotice title="This could not be saved">{getErrorMessage(saveError)}</ErrorNotice>
      )}
      {showSummary && <FormErrorSummary form={form} labels={labelsFor(lines.fields.length)} />}

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Hotel and stay" subtitle="Nights come from the dates" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <FormField label="Hotel" required error={errors.hotelId?.message}>
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
                    {hotelOptions.map((hotel) => (
                      <option key={hotel.id} value={hotel.id}>
                        {hotel.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField label="Vendor" required error={errors.vendorId?.message}>
                {(field) => (
                  <Select {...field} {...form.register('vendorId')}>
                    <option value="">Choose a vendor</option>
                    {vendorOptions.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField
                label="Check-in"
                required
                error={errors.checkIn?.message}
                hint={calendarHint(checkIn)}
              >
                {(field) => <Input {...field} type="date" {...form.register('checkIn')} />}
              </FormField>
              <FormField
                label="Check-out"
                required
                error={errors.checkOut?.message}
                hint={calendarHint(checkOut)}
              >
                {(field) => <Input {...field} type="date" {...form.register('checkOut')} />}
              </FormField>
            </div>
          </Card>

          <Card>
            <CardHeader title="Rooms and cost" />
            <div className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Currency" required error={errors.currencyCode?.message}>
                  {(field) => (
                    <Select
                      {...field}
                      {...currencyField}
                      onChange={(event) => {
                        void currencyField.onChange(event);
                        handleCurrencyChange(event.target.value);
                      }}
                    >
                      {currencyOptions.map((currency) => (
                        <option key={currency.code} value={currency.code}>
                          {currency.code}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
                <FormField
                  label="Rate against PKR"
                  required
                  error={errors.rateToPkr?.message}
                  hint="Kept with this purchase. Later rate changes never alter it."
                >
                  {(field) => (
                    <Input
                      {...field}
                      inputMode="decimal"
                      readOnly={currencyCode === RATE_BASE_CURRENCY}
                      {...form.register('rateToPkr')}
                    />
                  )}
                </FormField>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <label className="text-foreground flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-primary size-4" {...form.register('perNight')} />
                  Rate is per night
                </label>
                <label className="text-foreground flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-primary size-4" {...form.register('sameRate')} />
                  Same rate for all lines
                </label>
              </div>
              <RoomLinesField
                form={form}
                lines={lines}
                roomTypes={roomTypes}
                onRoomTypeChange={handleRoomTypeChange}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="Meals" />
            <div className="p-5">
              <MealFields form={form} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Notes" />
            <div className="p-5">
              <FormField label="Notes" error={errors.notes?.message}>
                {(field) => <Textarea {...field} {...form.register('notes')} />}
              </FormField>
            </div>
          </Card>
        </div>

        <Card className="xl:sticky xl:top-5">
          <CardHeader title="Totals" />
          <PurchaseTotals control={form.control} currencies={currencies} />
          <div className="border-border flex flex-wrap justify-end gap-2 border-t px-5 py-3">
            <Link to={cancelTo} className={buttonClass('secondary')}>
              Cancel
            </Link>
            <Button type="submit" isLoading={isSubmitting}>
              Save as draft
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Discard your changes?"
        confirmLabel="Discard"
        tone="danger"
      >
        What you entered in this form has not been saved.
      </ConfirmDialog>
    </form>
  );
}
