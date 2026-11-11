import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useFieldArray, useForm, useFormState, useWatch, type Path } from 'react-hook-form';
import { Link, useBlocker } from 'react-router';

import { Callout } from '@/components/feedback/Callout';
import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { FormErrorSummary } from '@/components/form/FormErrorSummary';
import { FormField } from '@/components/form/FormField';
import { FormSection } from '@/components/form/FormSection';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Segmented } from '@/components/ui/Choice';
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
import type { Partner } from '@/features/partners';
import type { ConversionRule, RoomType } from '@/features/room-types';
import { getErrorMessage } from '@/lib/api/api-error';
import { useCan } from '@/lib/auth/session';
import { rateOn } from '@/lib/money/money';

import { MEAL_PLANS, type ContractView } from '../api/contract.schemas';
import type { ContractContext } from '../api/contracts.api';
import { overbookingPreview, type DraftLine } from '../domain/overbooking';
import {
  contractFormSchema,
  emptyEntry,
  toFormValues,
  type ContractFormValues,
} from './contract-form.schema';
import { ContractTotalsPanel } from './ContractTotalsPanel';
import { HotelEntryFields, type HotelOption } from './HotelEntryFields';
import { MEAL_PLAN_LABELS } from './meal-plan-labels';
import { OverbookingList } from './OverbookingList';

type Labels = Partial<Record<Path<ContractFormValues>, string>>;

const DEFAULT_MEAL_RATE = '75';

function labelsFor(hotels: ContractFormValues['hotels']): Labels {
  const labels: Labels = {
    agentId: 'Agent',
    date: 'Contract date',
    currencyCode: 'Currency',
    rateToPkr: 'Rate against PKR',
    mealRate: 'Meal rate',
  };
  hotels.forEach((entry, h) => {
    const hotel = `Hotel ${String(h + 1)}`;
    labels[`hotels.${h}.hotelId`] = `${hotel}: hotel`;
    labels[`hotels.${h}.checkIn`] = `${hotel}: check-in`;
    labels[`hotels.${h}.checkOut`] = `${hotel}: check-out`;
    labels[`hotels.${h}.doubleRate`] = `${hotel}: double room rate`;
    labels[`hotels.${h}.extraBedRate`] = `${hotel}: extra bed rate`;
    labels[`hotels.${h}.flatRate`] = `${hotel}: flat rate`;
    entry.lines.forEach((line, l) => {
      const prefix = `${hotel}, line ${String(l + 1)}`;
      labels[`hotels.${h}.lines.${l}.soldAsTypeId`] = `${prefix}: sold as`;
      labels[`hotels.${h}.lines.${l}.rooms`] = `${prefix}: rooms`;
      labels[`hotels.${h}.lines.${l}.personsPerRoom`] = `${prefix}: persons per room`;
      line.allocations.forEach((_, a) => {
        const vendor = `${prefix}, vendor ${String(a + 1)}`;
        labels[`hotels.${h}.lines.${l}.allocations.${a}.purchaseId`] = `${vendor}: purchase`;
        labels[`hotels.${h}.lines.${l}.allocations.${a}.checkIn`] = `${vendor}: from`;
        labels[`hotels.${h}.lines.${l}.allocations.${a}.checkOut`] = `${vendor}: until`;
        labels[`hotels.${h}.lines.${l}.allocations.${a}.rooms`] = `${vendor}: rooms`;
      });
    });
  });
  return labels;
}

/** Only finished lines can be checked against the ledger. */
function draftLines(hotels: ContractFormValues['hotels']): DraftLine[] {
  return hotels.flatMap((entry) =>
    entry.hotelId !== '' && entry.checkIn !== '' && entry.checkOut > entry.checkIn
      ? entry.lines
          .filter((line) => line.sourceTypeId !== '' && Number.isInteger(line.rooms) && line.rooms > 0)
          .map((line) => ({
            hotelId: entry.hotelId,
            soldAsTypeId: line.soldAsTypeId,
            sourceTypeId: line.sourceTypeId,
            checkIn: entry.checkIn,
            checkOut: entry.checkOut,
            rooms: line.rooms,
          }))
      : [],
  );
}

interface ContractFormProps {
  contract: ContractView | null;
  agents: readonly Partner[];
  hotels: readonly HotelOption[];
  roomTypes: RoomType[];
  rules: ConversionRule[];
  currencies: readonly CurrencyRecord[];
  rates: readonly ExchangeRateRecord[];
  months: CalendarMonth[];
  context: ContractContext;
  today: string;
  cancelTo: string;
  /** A Confirmed record ends in a review of what the change does, so the label says so. */
  submitLabel?: string;
  /** Must reject on failure, so the error stays on screen. */
  onSave: (values: ContractFormValues) => Promise<void>;
}

export function ContractForm({
  contract,
  agents,
  hotels,
  roomTypes,
  rules,
  currencies,
  rates,
  months,
  context,
  today,
  cancelTo,
  submitLabel = 'Save as draft',
  onSave,
}: ContractFormProps) {
  const form = useForm<ContractFormValues>({
    resolver: zodResolver(
      contractFormSchema({ roomTypes, supplies: context.supplies, taken: context.taken }),
    ),
    mode: 'onTouched',
    defaultValues: contract
      ? toFormValues(contract)
      : {
          agentId: '',
          date: today,
          currencyCode: DEFAULT_CURRENCY,
          rateToPkr: rateOn(rates, DEFAULT_CURRENCY, today)?.rateToPkr ?? '',
          mealKind: 'none',
          mealRate: '',
          notes: '',
          hotels: [emptyEntry()],
        },
  });
  const entries = useFieldArray({ control: form.control, name: 'hotels' });
  const { errors, isDirty, isSubmitting } = useFormState({ control: form.control });
  const watchedHotels = useWatch({ control: form.control, name: 'hotels' });
  const mealKind = useWatch({ control: form.control, name: 'mealKind' });
  const currencyCode = useWatch({ control: form.control, name: 'currencyCode' });
  const [showSummary, setShowSummary] = useState(false);
  const canSetRate = useCan()('finance.set_rate');
  const [saveError, setSaveError] = useState<unknown>(null);
  const [showRate, setShowRate] = useState(false);
  // The save itself navigates away, so leaving while it runs needs no question.
  const blocker = useBlocker(isDirty && !isSubmitting);

  const preview = overbookingPreview(draftLines(watchedHotels), {
    purchases: context.purchases,
    sales: context.sales,
    rules,
    roomTypes,
  });
  const hotelName = (id: string) => hotelOptions.find((hotel) => hotel.id === id)?.name ?? '';

  function handleCurrencyChange(code: string) {
    form.setValue('rateToPkr', rateOn(rates, code, today)?.rateToPkr ?? '', {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleMealChange(kind: string) {
    if (kind !== 'none' && form.getValues('mealRate') === '') {
      form.setValue('mealRate', DEFAULT_MEAL_RATE, { shouldDirty: true });
    }
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

  const currencyField = form.register('currencyCode');
  const mealField = form.register('mealKind');
  // A record keeps its own agent, hotels and currency even after they are deactivated.
  const agentOptions =
    !contract || agents.some((agent) => agent.id === contract.agentId)
      ? agents
      : [{ id: contract.agentId, name: contract.agentName }, ...agents];
  const hotelOptions: readonly HotelOption[] = [
    ...(contract?.hotels ?? [])
      .filter(
        (entry, index, all) =>
          !hotels.some((hotel) => hotel.id === entry.hotelId) &&
          all.findIndex((other) => other.hotelId === entry.hotelId) === index,
      )
      .map((entry) => ({ id: entry.hotelId, name: entry.hotelName })),
    ...hotels,
  ];
  const currencyOptions = currencies.filter(
    (currency) => currency.enabled || currency.code === contract?.currencyCode,
  );

  const contractDate = useWatch({ control: form.control, name: 'date' });
  const rateToPkr = useWatch({ control: form.control, name: 'rateToPkr' });
  const isRateEditable = currencyCode !== RATE_BASE_CURRENCY && canSetRate;
  const rateVisible = showRate || Boolean(errors.rateToPkr);
  const dateLabel = contractDate ? formatDay(contractDate, months) : '';
  const mealOptions = [
    { value: 'none', label: 'No meals' },
    ...MEAL_PLANS.map((plan) => ({ value: plan, label: MEAL_PLAN_LABELS[plan] })),
  ];

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5 px-(--page-gutter) pt-4 pb-10">
      {saveError !== null && (
        <ErrorNotice title="This could not be saved">{getErrorMessage(saveError)}</ErrorNotice>
      )}
      {showSummary && <FormErrorSummary form={form} labels={labelsFor(watchedHotels)} />}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <Card>
            <FormSection title="Agent">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <FormField label="Agent" required error={errors.agentId?.message}>
                  {(field) => (
                    <Select {...field} {...form.register('agentId')}>
                      <option value="">Choose an agent</option>
                      {agentOptions.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
                <FormField
                  label="Contract date"
                  required
                  error={errors.date?.message}
                  aside={dateLabel && dateLabel !== contractDate ? dateLabel : undefined}
                >
                  {(field) => <DateInput {...field} {...form.register('date')} />}
                </FormField>
              </div>
            </FormSection>
            <FormSection title="Meals">
              <div className="flex flex-wrap items-start gap-4">
                <Segmented
                  legend="Meal plan"
                  options={mealOptions}
                  register={{
                    ...mealField,
                    onChange: (event) => {
                      void mealField.onChange(event);
                      handleMealChange(event.target.value);
                    },
                  }}
                />
                {mealKind !== 'none' && (
                  <FormField
                    label="Meal rate, per person per night"
                    hideLabel
                    required
                    error={errors.mealRate?.message}
                    className="w-44"
                  >
                    {(field) => (
                      <div className="relative">
                        <Input
                          {...field}
                          inputMode="decimal"
                          className="ps-12 tabular-nums"
                          {...form.register('mealRate')}
                        />
                        <span className="text-muted pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-xs">
                          {currencyCode}
                        </span>
                      </div>
                    )}
                  </FormField>
                )}
                {mealKind !== 'none' && (
                  <span className="text-muted text-meta flex h-(--control-height) items-center">
                    per person per night
                  </span>
                )}
              </div>
            </FormSection>
          </Card>

          {entries.fields.map((field, index) => (
            <HotelEntryFields
              key={field.id}
              form={form}
              index={index}
              hotels={hotelOptions}
              roomTypes={roomTypes}
              rules={rules}
              supplies={context.supplies}
              taken={context.taken}
              months={months}
              canRemove={entries.fields.length > 1}
              onRemove={() => {
                entries.remove(index);
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              entries.append(emptyEntry(), { shouldFocus: false });
            }}
            className="rounded-card border-border-strong text-secondary hover:border-faint hover:bg-surface hover:text-foreground flex w-full items-center justify-center gap-2 border border-dashed py-3 text-sm font-medium transition-colors duration-150"
          >
            <Plus aria-hidden className="size-4" />
            Add another hotel
          </button>

          <Card>
            <FormSection>
              <FormField label="Notes" error={errors.notes?.message}>
                {(field) => (
                  <Textarea
                    {...field}
                    rows={2}
                    className="min-h-16"
                    placeholder="Anything the team should know about this sale"
                    {...form.register('notes')}
                  />
                )}
              </FormField>
            </FormSection>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-6">
          {preview.shortages.length > 0 && (
            <Callout tone="danger" title="This sale would overbook">
              <OverbookingList
                preview={preview}
                hotelName={hotelName}
                roomTypes={roomTypes}
                months={months}
              />
            </Callout>
          )}
          <Card>
            <CardHeader title="Summary" />
            <ContractTotalsPanel
              control={form.control}
              currencies={currencies}
              roomTypes={roomTypes}
              hotelName={hotelName}
            />
            <div className="border-border text-meta space-y-2 border-t px-4 py-3">
              <div className="flex items-center justify-between gap-2">
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
                {currencyCode !== RATE_BASE_CURRENCY && (
                  <span className="text-muted flex items-center gap-2 tabular-nums">
                    1 {currencyCode} = {rateToPkr || '…'} PKR
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
                  </span>
                )}
              </div>
              <div className={rateVisible ? undefined : 'hidden'}>
                <FormField
                  label="Rate against PKR"
                  required
                  error={errors.rateToPkr?.message}
                  hint="Frozen on this contract"
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
              {!contract || contract.status === 'draft' ? (
                <p className="text-muted text-center text-xs">You confirm it on the next screen</p>
              ) : null}
            </div>
          </Card>
        </div>
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
