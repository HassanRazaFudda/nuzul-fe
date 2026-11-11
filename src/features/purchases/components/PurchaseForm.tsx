import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type SubmitEvent } from 'react';
import { useFieldArray, useForm, useFormState, useWatch, type Path } from 'react-hook-form';
import { Link, useBlocker } from 'react-router';

import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { FormErrorSummary } from '@/components/form/FormErrorSummary';
import { FormField } from '@/components/form/FormField';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { FormSection } from '@/components/form/FormSection';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Switch } from '@/components/ui/Choice';
import { DateInput } from '@/components/ui/DateInput';
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
import { useCan } from '@/lib/auth/session';
import { nightsBetween } from '@/lib/format/dates';
import { rateOn } from '@/lib/money/money';

import type { PurchaseView } from '../api/purchase.schemas';
import { referenceRate } from '../domain/purchase-totals';
import { MealFields } from './MealFields';
import { emptyLine, purchaseFormSchema, toFormValues, type PurchaseFormValues } from './purchase-form.schema';
import type { PurchasePrefill } from './purchase-prefill';
import { PurchaseTotals } from './PurchaseTotals';
import { useLivePurchaseTotals } from './use-live-purchase-totals';
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
  /** A Confirmed record ends in a review of what the change does, so the label says so. */
  submitLabel?: string;
  /** A suggested purchase, such as from the ledger. New purchases only. */
  prefill?: PurchasePrefill | null;
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
  submitLabel = 'Save as draft',
  prefill = null,
  onSave,
}: PurchaseFormProps) {
  const prefilledHotel = hotels.find((hotel) => hotel.id === prefill?.hotelId);
  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    mode: 'onTouched',
    defaultValues: purchase
      ? toFormValues(purchase)
      : {
          hotelId: prefill?.hotelId ?? '',
          vendorId: '',
          checkIn: prefill?.checkIn ?? '',
          checkOut: prefill?.checkOut ?? '',
          currencyCode: DEFAULT_CURRENCY,
          rateToPkr: rateOn(rates, DEFAULT_CURRENCY, today)?.rateToPkr ?? '',
          perNight: true,
          sameRate: false,
          sharedRate: '',
          lines: [
            {
              ...emptyLine(),
              roomTypeId: prefill?.roomType?.id ?? '',
              rooms: prefill?.rooms ?? Number.NaN,
              personsPerRoom: prefill?.roomType?.capacity ?? Number.NaN,
              rate:
                prefilledHotel?.rateCurrency === DEFAULT_CURRENCY && prefill?.roomType
                  ? referenceRate(prefilledHotel, prefill.roomType.capacity)
                  : '',
            },
          ],
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
  const canSetRate = useCan()('finance.set_rate');
  const [saveError, setSaveError] = useState<unknown>(null);
  const [showRate, setShowRate] = useState(false);
  const live = useLivePurchaseTotals(form.control, currencies);
  // The save itself navigates away, so leaving while it runs needs no question. A suggested
  // purchase counts as unsaved work from the start.
  const blocker = useBlocker((isDirty || prefill !== null) && !isSubmitting);

  const calendarHint = (iso: string) => {
    if (!iso) return undefined;
    const label = formatDay(iso, months);
    return label === iso ? 'Not in calendar' : label;
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

  const nights = checkIn && checkOut && checkOut > checkIn ? nightsBetween(checkIn, checkOut) : 0;
  const isRateEditable = currencyCode !== RATE_BASE_CURRENCY && canSetRate;
  const rateVisible = showRate || Boolean(errors.rateToPkr);

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5 px-(--page-gutter) pt-4 pb-10">
      {saveError !== null && (
        <ErrorNotice title="This could not be saved">{getErrorMessage(saveError)}</ErrorNotice>
      )}
      {showSummary && <FormErrorSummary form={form} labels={labelsFor(lines.fields.length)} />}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="min-w-0">
          <FormSection title="Hotel and vendor">
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
          </FormSection>

          <FormSection
            title="Stay"
            action={
              nights > 0 && (
                <span className="text-secondary text-meta tabular-nums">
                  {nights} {nights === 1 ? 'night' : 'nights'}
                </span>
              )
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Check-in"
                required
                error={errors.checkIn?.message}
                aside={calendarHint(checkIn)}
              >
                {(field) => <DateInput {...field} {...form.register('checkIn')} />}
              </FormField>
              <FormField
                label="Check-out"
                required
                error={errors.checkOut?.message}
                aside={calendarHint(checkOut)}
              >
                {(field) => <DateInput {...field} {...form.register('checkOut')} />}
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Rooms and cost"
            action={
              <div className="flex items-center gap-4">
                <Switch label="Rate per night" {...form.register('perNight')} />
                <Select
                  aria-label="Currency"
                  className="text-meta h-(--control-height-sm) w-24"
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
              </div>
            }
          >
            <RoomLinesField
              form={form}
              lines={lines}
              roomTypes={roomTypes}
              onRoomTypeChange={handleRoomTypeChange}
              lineCosts={live.totals.lineCosts}
              decimals={live.format.decimals}
            />
          </FormSection>

          <FormSection title="Meals">
            <MealFields form={form} />
          </FormSection>

          <FormSection>
            <FormField label="Notes" error={errors.notes?.message}>
              {(field) => (
                <Textarea
                  {...field}
                  rows={2}
                  className="min-h-16"
                  placeholder="Anything the team should know about this purchase"
                  {...form.register('notes')}
                />
              )}
            </FormField>
          </FormSection>
        </Card>

        <Card className="xl:sticky xl:top-6">
          <CardHeader title="Summary" />
          <PurchaseTotals control={form.control} currencies={currencies} />
          <div className="border-border text-meta space-y-2 border-t px-4 py-3">
            {currencyCode === RATE_BASE_CURRENCY ? (
              <p className="text-muted">Amounts are in {RATE_BASE_CURRENCY}</p>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted tabular-nums">
                  1 {currencyCode} = {live.rateToPkr || '…'} PKR
                </span>
                {isRateEditable && !rateVisible && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowRate(true);
                    }}
                    className="text-secondary hover:text-foreground underline underline-offset-2"
                  >
                    Change
                  </button>
                )}
              </div>
            )}
            <div className={rateVisible ? undefined : 'hidden'}>
              <FormField
                label="Rate against PKR"
                required
                error={errors.rateToPkr?.message}
                hint="Frozen on this purchase"
              >
                {(field) => (
                  <Input
                    {...field}
                    inputMode="decimal"
                    readOnly={!isRateEditable}
                    {...form.register('rateToPkr')}
                  />
                )}
              </FormField>
            </div>
          </div>
          <div className="border-border flex flex-col gap-2 border-t px-4 py-4">
            <Button type="submit" isLoading={isSubmitting} className="w-full">
              {submitLabel}
            </Button>
            <Link to={cancelTo} className={`${buttonClass('ghost')} w-full`}>
              Cancel
            </Link>
            {!purchase || purchase.status === 'draft' ? (
              <p className="text-muted text-center text-xs">You confirm it on the next screen</p>
            ) : null}
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
