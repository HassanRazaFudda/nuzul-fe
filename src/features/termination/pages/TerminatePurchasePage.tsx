import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient, useSuspenseQueries } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useForm, useFormState, useWatch, type Path } from 'react-hook-form';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { toast } from '@/components/feedback/toast';
import { FormErrorSummary } from '@/components/form/FormErrorSummary';
import { FormField } from '@/components/form/FormField';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { calendarMonthsQuery, formatDay } from '@/features/calendar';
import { ImpactPreview, impactOf } from '@/features/changes';
import { currenciesQuery, exchangeRatesQuery, RATE_BASE_CURRENCY } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';
import { ledgerSourcesQuery } from '@/features/inventory';
import { purchaseDetailQuery } from '@/features/purchases';
import { conversionRulesQuery, isConversionAllowed, roomTypesQuery } from '@/features/room-types';
import { getErrorMessage } from '@/lib/api/api-error';
import { useCan } from '@/lib/auth/session';
import { todayIso } from '@/lib/format/dates';
import { rateOn } from '@/lib/money/money';

import { terminationApi } from '../api/termination.api';
import { DecisionRow } from '../components/DecisionRow';
import {
  terminationFormSchema,
  toDecisions,
  type TerminationFormValues,
} from '../components/termination-form.schema';
import { affectedLines, applyTermination } from '../domain/termination';

const LABELS: Partial<Record<Path<TerminationFormValues>, string>> = {
  terminationDate: 'Termination date',
  effectiveDate: 'First released night',
  reason: 'Reason',
  penaltyAmount: 'Penalty',
  refundAmount: 'Refund',
};

export function TerminatePurchasePage() {
  const { id = '' } = useParams();
  const [
    { data: purchase },
    { data: sources },
    { data: hotels },
    { data: roomTypes },
    { data: rules },
    { data: currencies },
    { data: rates },
    { data: months },
  ] = useSuspenseQueries({
    queries: [
      purchaseDetailQuery(id),
      ledgerSourcesQuery,
      hotelOptionsQuery,
      roomTypesQuery,
      conversionRulesQuery,
      currenciesQuery,
      exchangeRatesQuery,
      calendarMonthsQuery,
    ],
  });
  const queryClient = useQueryClient();
  const canOverride = useCan()('inventory.override_overbooking');
  const navigate = useNavigate();
  const [today] = useState(() => todayIso(new Date()));
  const [showSummary, setShowSummary] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const terminate = useMutation({
    mutationFn: terminationApi.terminate,
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const rateFor = (code: string, date: string) =>
    code === RATE_BASE_CURRENCY ? '1' : (rateOn(rates, code, date)?.rateToPkr ?? null);
  const form = useForm<TerminationFormValues>({
    resolver: (values, context, options) =>
      zodResolver(
        terminationFormSchema({
          checkIn: purchase.checkIn,
          checkOut: purchase.checkOut,
          affectedFor: (effectiveDate) => affectedLines(sources, id, effectiveDate),
          hasRate: (code) => rateFor(code, values.terminationDate) !== null,
        }),
      )(values, context, options),
    mode: 'onTouched',
    defaultValues: {
      terminationDate: today,
      effectiveDate: '',
      reason: '',
      penaltyAmount: '',
      penaltyCurrency: purchase.currencyCode,
      refundAmount: '',
      refundCurrency: purchase.currencyCode,
      decisions: {},
    },
  });
  const { errors, isDirty, isSubmitting } = useFormState({ control: form.control });
  const effectiveDate = useWatch({ control: form.control, name: 'effectiveDate' });
  const decisionValues = useWatch({ control: form.control, name: 'decisions' });
  const blocker = useBlocker(isDirty && !isSubmitting && !terminate.isPending && !terminate.isSuccess);

  const isEffectiveUsable = effectiveDate > purchase.checkIn && effectiveDate < purchase.checkOut;
  const affected = isEffectiveUsable ? affectedLines(sources, id, effectiveDate) : [];
  const ledgerPurchase = sources.purchases.find((item) => item.id === id);
  const result =
    isEffectiveUsable && ledgerPurchase
      ? applyTermination(sources, ledgerPurchase, effectiveDate, toDecisions(decisionValues))
      : null;
  const impact = result ? impactOf(sources, result, { before: sources.sales, after: result.sales }) : null;

  const names = {
    hotelName: (hotelId: string) =>
      hotels.find((hotel) => hotel.id === hotelId)?.name ??
      (hotelId === purchase.hotelId ? purchase.hotelName : hotelId),
    roomTypeName: (typeId: string) => roomTypes.find((type) => type.id === typeId)?.name ?? typeId,
  };

  if (purchase.status !== 'confirmed') {
    return (
      <>
        <PageHeader title={`Terminate ${purchase.number}`} />
        <div className="p-5 lg:p-8">
          <Card>
            <EmptyState
              title="Only a confirmed purchase can be terminated"
              action={
                <Link to={`/purchases/${id}`} className={buttonClass('secondary')}>
                  Back to {purchase.number}
                </Link>
              }
            />
          </Card>
        </div>
      </>
    );
  }

  async function handleTerminate() {
    const values = form.getValues();
    setSaveError(null);
    const money = (amount: string, currencyCode: string) => {
      const rateToPkr = rateFor(currencyCode, values.terminationDate);
      return amount === '' || rateToPkr === null ? null : { amount, currencyCode, rateToPkr };
    };
    try {
      await terminate.mutateAsync({
        purchaseId: id,
        version: purchase.version,
        terminationDate: values.terminationDate,
        effectiveDate: values.effectiveDate,
        reason: values.reason,
        penalty: money(values.penaltyAmount, values.penaltyCurrency),
        refund: money(values.refundAmount, values.refundCurrency),
        decisions: toDecisions(values.decisions),
        stamp: sources.stamp,
      });
      toast(`${purchase.number} terminated`);
      await navigate(`/purchases/${id}`);
    } catch (error) {
      setSaveError(error);
    }
    setIsConfirming(false);
  }

  function handleSubmit(event: SubmitEvent) {
    void form.handleSubmit(
      () => {
        setIsConfirming(true);
      },
      () => {
        setShowSummary(true);
      },
    )(event);
  }

  const typeName = (typeId: string) => roomTypes.find((type) => type.id === typeId)?.name ?? typeId;
  const decisionLabels = Object.fromEntries(
    affected.flatMap(({ sale }) => [
      [`decisions.${sale.id}.kind`, `${sale.reference} ${typeName(sale.soldAsTypeId)}: decision`],
      [
        `decisions.${sale.id}.sourceTypeId`,
        `${sale.reference} ${typeName(sale.soldAsTypeId)}: take rooms from`,
      ],
      [`decisions.${sale.id}.reason`, `${sale.reference} ${typeName(sale.soldAsTypeId)}: reason`],
    ]),
  ) as Partial<Record<Path<TerminationFormValues>, string>>;
  const currencyOptions = currencies.filter((currency) => currency.enabled);
  const worsens = impact?.worsens ?? false;

  return (
    <>
      <PageHeader
        title={`Terminate ${purchase.number}`}
        subtitle={`${purchase.hotelName} from ${purchase.vendorName}, ${formatDay(purchase.checkIn, months)} to ${formatDay(purchase.checkOut, months)}`}
      />
      <form noValidate onSubmit={handleSubmit} className="space-y-5 p-5 lg:p-8">
        {saveError !== null && (
          <ErrorNotice title="This could not be saved">{getErrorMessage(saveError)}</ErrorNotice>
        )}
        {showSummary && <FormErrorSummary form={form} labels={{ ...LABELS, ...decisionLabels }} />}

        <Card>
          <CardHeader
            title="1. Dates and money"
            subtitle="Nights from the first released night leave the ledger"
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <FormField label="Termination date" required error={errors.terminationDate?.message}>
              {(field) => <Input {...field} type="date" {...form.register('terminationDate')} />}
            </FormField>
            <FormField
              label="First released night"
              required
              error={errors.effectiveDate?.message}
              hint={effectiveDate ? formatDay(effectiveDate, months) : undefined}
            >
              {(field) => <Input {...field} type="date" {...form.register('effectiveDate')} />}
            </FormField>
            <FormField label="Reason" required error={errors.reason?.message} className="sm:col-span-2">
              {(field) => <Textarea {...field} {...form.register('reason')} />}
            </FormField>
            {(
              [
                ['penalty', 'Penalty paid', 'penaltyAmount', 'penaltyCurrency'],
                ['refund', 'Refund received', 'refundAmount', 'refundCurrency'],
              ] as const
            ).map(([key, label, amountField, currencyField]) => (
              <div key={key} className="grid grid-cols-[1fr_7rem] items-start gap-2">
                <FormField label={label} error={errors[amountField]?.message} hint="Optional">
                  {(field) => <Input {...field} inputMode="decimal" {...form.register(amountField)} />}
                </FormField>
                <FormField label={`${label} currency`}>
                  {(field) => (
                    <Select {...field} {...form.register(currencyField)}>
                      {currencyOptions.map((currency) => (
                        <option key={currency.code} value={currency.code}>
                          {currency.code}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="2. Sales losing their rooms"
            subtitle="Every line needs a decision. Nothing is removed without one."
          />
          {!isEffectiveUsable ? (
            <p className="text-muted px-5 py-4 text-sm">
              Choose the first released night to see the affected sales.
            </p>
          ) : affected.length === 0 ? (
            <p className="text-muted px-5 py-4 text-sm">No sale uses this purchase from that night on.</p>
          ) : (
            <ul className="divide-border divide-y">
              {affected.map((line) => (
                <DecisionRow
                  key={line.sale.id}
                  form={form}
                  line={line}
                  hotelName={names.hotelName(line.sale.hotelId)}
                  roomTypes={roomTypes}
                  otherSources={roomTypes.filter(
                    (type) =>
                      type.id !== line.sale.roomTypeId &&
                      isConversionAllowed(
                        rules,
                        roomTypes,
                        line.sale.hotelId,
                        type.id,
                        line.sale.soldAsTypeId,
                      ),
                  )}
                  uncovered={result?.uncovered.get(line.sale.id) ?? []}
                  months={months}
                />
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="3. Review" subtitle="The ledger before and after, with the decisions above" />
          <div className="text-muted p-5 text-sm">
            {impact ? (
              <ImpactPreview impact={impact} names={names} months={months} />
            ) : (
              'Choose the first released night to see the effect.'
            )}
          </div>
          <div className="border-border flex flex-wrap justify-end gap-2 border-t px-5 py-3">
            <Link to={`/purchases/${id}`} className={buttonClass('secondary')}>
              Cancel
            </Link>
            <Button type="submit" variant="danger">
              Terminate purchase
            </Button>
          </div>
        </Card>
      </form>

      <ConfirmDialog
        open={isConfirming}
        onCancel={() => {
          setIsConfirming(false);
        }}
        onConfirm={() => void handleTerminate()}
        title={worsens ? `${purchase.number}: terminate with overbooking?` : `Terminate ${purchase.number}?`}
        confirmLabel={worsens ? 'Terminate with overbooking' : 'Terminate purchase'}
        cancelLabel="Go back"
        tone="danger"
        isBusy={terminate.isPending}
        isConfirmDisabled={worsens && !canOverride}
      >
        {worsens &&
          (canOverride
            ? 'Some nights end up short. The sales on them are tagged OVERBOOKED. '
            : 'Some nights end up short, and going ahead needs a permission you do not hold. Change the decisions so nothing is short. ')}
        The purchase stays on record as Terminated, and this cannot be undone.
      </ConfirmDialog>
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
    </>
  );
}
