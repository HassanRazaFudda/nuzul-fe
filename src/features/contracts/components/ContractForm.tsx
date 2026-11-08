import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
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
import type { CalendarMonth } from '@/features/calendar';
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

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5 p-5 lg:p-8">
      {saveError !== null && (
        <ErrorNotice title="This could not be saved">{getErrorMessage(saveError)}</ErrorNotice>
      )}
      {showSummary && <FormErrorSummary form={form} labels={labelsFor(watchedHotels)} />}

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Contract" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
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
              <FormField label="Contract date" required error={errors.date?.message}>
                {(field) => <Input {...field} type="date" {...form.register('date')} />}
              </FormField>
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
                hint="Kept with this contract. Later rate changes never alter it."
              >
                {(field) => (
                  <Input
                    {...field}
                    inputMode="decimal"
                    readOnly={currencyCode === RATE_BASE_CURRENCY || !canSetRate}
                    {...form.register('rateToPkr')}
                  />
                )}
              </FormField>
              <FormField label="Meal plan">
                {(field) => (
                  <Select
                    {...field}
                    {...mealField}
                    onChange={(event) => {
                      void mealField.onChange(event);
                      handleMealChange(event.target.value);
                    }}
                  >
                    <option value="none">None</option>
                    {MEAL_PLANS.map((plan) => (
                      <option key={plan} value={plan}>
                        {MEAL_PLAN_LABELS[plan]}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              {mealKind !== 'none' && (
                <FormField
                  label="Meal rate"
                  required
                  error={errors.mealRate?.message}
                  hint="Per person per night"
                >
                  {(field) => <Input {...field} inputMode="decimal" {...form.register('mealRate')} />}
                </FormField>
              )}
            </div>
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
          <Button
            variant="secondary"
            icon={<Plus aria-hidden className="size-4" />}
            onClick={() => {
              entries.append(emptyEntry(), { shouldFocus: false });
            }}
          >
            Add hotel
          </Button>

          <Card>
            <CardHeader title="Notes" />
            <div className="p-5">
              <FormField label="Notes" error={errors.notes?.message}>
                {(field) => <Textarea {...field} {...form.register('notes')} />}
              </FormField>
            </div>
          </Card>
        </div>

        <div className="space-y-5 xl:sticky xl:top-5">
          {preview.shortages.length > 0 && (
            <ErrorNotice title="This would overbook">
              <OverbookingList
                preview={preview}
                hotelName={hotelName}
                roomTypes={roomTypes}
                months={months}
              />
            </ErrorNotice>
          )}
          <Card>
            <CardHeader title="Totals" />
            <ContractTotalsPanel
              control={form.control}
              currencies={currencies}
              roomTypes={roomTypes}
              hotelName={hotelName}
            />
            <div className="border-border flex flex-wrap justify-end gap-2 border-t px-5 py-3">
              <Link to={cancelTo} className={buttonClass('secondary')}>
                Cancel
              </Link>
              <Button type="submit" isLoading={isSubmitting}>
                {submitLabel}
              </Button>
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
