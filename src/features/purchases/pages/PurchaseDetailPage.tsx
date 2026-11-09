import { useQueryClient, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { toast } from '@/components/feedback/toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Detail } from '@/components/ui/Detail';
import { Stat, SummaryStrip } from '@/components/ui/Stat';
import { calendarMonthsQuery, formatDay } from '@/features/calendar';
import { HistoryCard, ImpactReviewDialog, type Impact } from '@/features/changes';
import { currenciesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';
import { ledgerSourcesQuery } from '@/features/inventory';
import { roomTypesQuery } from '@/features/room-types';
import { getErrorMessage } from '@/lib/api/api-error';
import { useCan } from '@/lib/auth/session';
import { formatIsoDate, nightsBetween } from '@/lib/format/dates';
import { formatAmount, formatMoney } from '@/lib/money/money';

import {
  adjustmentsQuery,
  purchaseDetailQuery,
  purchaseKeys,
  useCancelPurchase,
  useRestorePurchase,
  useSetPurchaseLocked,
  useConfirmPurchase,
  useRemovePurchase,
} from '../api/purchase.queries';
import { CHARGE_BASIS_LABELS, MEAL_BASIS_LABELS } from '../components/meal-labels';
import { PurchaseStatusBadge } from '../components/PurchaseStatusBadge';
import { purchaseImpact } from '../domain/purchase-change';

const PKR_FORMAT = { symbol: 'PKR', decimals: 2 };

type PendingAction = 'confirm' | 'delete';

export function PurchaseDetailPage() {
  const { id = '' } = useParams();
  const { data: purchase } = useSuspenseQuery(purchaseDetailQuery(id));
  const [
    { data: months },
    { data: roomTypes },
    { data: currencies },
    { data: hotels },
    { data: adjustments },
  ] = useSuspenseQueries({
    queries: [calendarMonthsQuery, roomTypesQuery, currenciesQuery, hotelOptionsQuery, adjustmentsQuery(id)],
  });
  const confirmPurchase = useConfirmPurchase();
  const cancelPurchase = useCancelPurchase();
  const restorePurchase = useRestorePurchase();
  const setLocked = useSetPurchaseLocked();
  const can = useCan();
  const removePurchase = useRemovePurchase();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [review, setReview] = useState<{ kind: 'cancel' | 'restore'; impact: Impact; stamp: string } | null>(
    null,
  );

  const { number, status, version, meal, currencyCode } = purchase;
  const format = currencies.find((item) => item.code === currencyCode) ?? {
    symbol: currencyCode,
    decimals: 2,
  };
  const nights = nightsBetween(purchase.checkIn, purchase.checkOut);
  const roomTotal = purchase.lines.reduce((total, line) => total + line.rooms, 0);
  const dayLabel = (iso: string) => `${formatDay(iso, months)} (${formatIsoDate(iso)})`;

  async function runAction() {
    setActionError(null);
    try {
      if (pending === 'confirm') {
        await confirmPurchase.mutateAsync({ id, version });
        toast(`${number} confirmed`);
      } else if (pending === 'delete') {
        await removePurchase.mutateAsync({ id, version });
        toast(`${number} deleted`);
        await navigate('/purchases?status=draft');
        queryClient.removeQueries({ queryKey: purchaseKeys.detail(id) });
      }
    } catch (error) {
      setActionError(error);
    }
    setPending(null);
  }

  /** Shows which sales lose their vendor, worked out from the records as they are now. */
  /** Works out what cancelling or restoring does, from the records as they are now. */
  async function startReview(kind: 'cancel' | 'restore') {
    setActionError(null);
    try {
      const sources = await queryClient.query(ledgerSourcesQuery);
      const replacement =
        kind === 'cancel'
          ? null
          : {
              id,
              number,
              hotelId: purchase.hotelId,
              vendorId: purchase.vendorId,
              vendorName: purchase.vendorName,
              checkIn: purchase.checkIn,
              checkOut: purchase.checkOut,
              lines: purchase.lines.map(({ roomTypeId, rooms }) => ({ roomTypeId, rooms })),
            };
      setReview({ kind, impact: purchaseImpact(sources, id, replacement), stamp: sources.stamp });
    } catch (error) {
      setActionError(error);
    }
  }

  async function handleReview(reason: string) {
    if (!review) return;
    if (review.kind === 'cancel') {
      await cancelPurchase.mutateAsync({ id, version, reason, stamp: review.stamp });
      toast(`${number} cancelled`);
    } else {
      await restorePurchase.mutateAsync({ id, version, reason, stamp: review.stamp });
      toast(`${number} restored`);
    }
    setReview(null);
  }

  function handleLock(locked: boolean) {
    setActionError(null);
    setLocked.mutate(
      { id, version, locked },
      {
        onSuccess: () => {
          toast(`${number} ${locked ? 'locked' : 'unlocked'}`);
        },
        onError: setActionError,
      },
    );
  }

  const names = {
    hotelName: (hotelId: string) =>
      hotels.find((hotel) => hotel.id === hotelId)?.name ??
      (hotelId === purchase.hotelId ? purchase.hotelName : hotelId),
    roomTypeName: (typeId: string) => roomTypes.find((type) => type.id === typeId)?.name ?? typeId,
  };
  const isBusy = confirmPurchase.isPending || removePurchase.isPending;

  return (
    <>
      <PageHeader
        title={number}
        subtitle={`${purchase.hotelName} from ${purchase.vendorName}`}
        status={<PurchaseStatusBadge status={status} />}
        action={
          <>
            {status === 'draft' && (
              <>
                {can('purchase.delete') && (
                  <Button
                    variant="danger-ghost"
                    onClick={() => {
                      setPending('delete');
                    }}
                  >
                    Delete
                  </Button>
                )}
                {can('purchase.edit') && (
                  <Link to={`/purchases/${id}/edit`} className={buttonClass('secondary')}>
                    Edit
                  </Link>
                )}
                {can('purchase.confirm') && (
                  <Button
                    onClick={() => {
                      setPending('confirm');
                    }}
                  >
                    Confirm
                  </Button>
                )}
              </>
            )}
            {status === 'confirmed' && (
              <>
                {can('purchase.delete') && (
                  <Button variant="danger-ghost" onClick={() => void startReview('cancel')}>
                    Cancel purchase
                  </Button>
                )}
                {can('purchase.unlock') && (
                  <Button
                    variant="ghost"
                    isLoading={setLocked.isPending}
                    onClick={() => {
                      handleLock(true);
                    }}
                  >
                    Lock
                  </Button>
                )}
                {can('purchase.terminate') && (
                  <Link to={`/purchases/${id}/terminate`} className={buttonClass('secondary')}>
                    Terminate
                  </Link>
                )}
                {can('purchase.edit') && (
                  <Link to={`/purchases/${id}/edit`} className={buttonClass('primary')}>
                    Edit
                  </Link>
                )}
              </>
            )}
            {status === 'locked' && can('purchase.unlock') && (
              <Button
                variant="secondary"
                isLoading={setLocked.isPending}
                onClick={() => {
                  handleLock(false);
                }}
              >
                Unlock
              </Button>
            )}
            {status === 'cancelled' && can('purchase.edit') && (
              <Button variant="secondary" onClick={() => void startReview('restore')}>
                Restore
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-5 p-5 lg:p-8">
        {actionError !== null && (
          <ErrorNotice title="This could not be done">{getErrorMessage(actionError)}</ErrorNotice>
        )}

        <SummaryStrip>
          <Stat label="Nights" value={nights} hint={`${String(roomTotal)} rooms`} />
          <Stat label="Room cost" value={formatMoney(purchase.roomCost.amount, format)} />
          <Stat label="Meal cost" value={formatMoney(purchase.mealCost.amount, format)} />
          <Stat
            label="Total"
            value={formatMoney(purchase.total.amount, format)}
            hint={formatMoney(purchase.total.amountPkr, PKR_FORMAT)}
          />
        </SummaryStrip>

        <Card>
          <CardHeader title="Stay" />
          <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
            <Detail label="Check-in">{dayLabel(purchase.checkIn)}</Detail>
            <Detail label="Check-out">{dayLabel(purchase.checkOut)}</Detail>
            <Detail label="Rate">
              {purchase.perNight ? 'Per night' : 'For the whole stay'}
              <span className="text-muted tabular-nums">
                {' · '}1 {currencyCode} = {purchase.rateToPkr} PKR
              </span>
            </Detail>
            <Detail label="Meals">
              {meal.pricing === 'none' && 'None'}
              {meal.pricing === 'included' && 'Included in the room rate'}
              {meal.pricing === 'separate' && (
                <span className="tabular-nums">
                  {formatMoney(meal.rate, format)}, {MEAL_BASIS_LABELS[meal.basis].toLowerCase()}
                  <span className="text-muted block text-[0.8125rem]">
                    {CHARGE_BASIS_LABELS[meal.chargeBasis]}
                    {purchase.mealMaximum !== null &&
                      ` · at most ${formatMoney(purchase.mealMaximum, format)}, not in the total`}
                  </span>
                </span>
              )}
            </Detail>
            {purchase.notes && (
              <Detail label="Notes" className="sm:col-span-2 xl:col-span-4">
                <span className="whitespace-pre-line">{purchase.notes}</span>
              </Detail>
            )}
          </dl>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Room lines" />
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-sm">
              <caption className="sr-only">Room lines</caption>
              <thead>
                <tr className="text-muted border-border border-b text-xs">
                  <th scope="col" className="px-5 py-2 text-start font-medium">
                    Room type
                  </th>
                  <th scope="col" className="px-5 py-2 text-end font-medium">
                    Rooms
                  </th>
                  <th scope="col" className="px-5 py-2 text-end font-medium">
                    Cost rate ({currencyCode})
                  </th>
                  <th scope="col" className="px-5 py-2 text-end font-medium">
                    Cost ({currencyCode})
                  </th>
                </tr>
              </thead>
              <tbody>
                {purchase.lines.map((line) => (
                  <tr
                    key={line.roomTypeId}
                    className="border-border text-foreground border-b last:border-b-0"
                  >
                    <td className="px-5 py-2.5">
                      {roomTypes.find((type) => type.id === line.roomTypeId)?.name ?? line.roomTypeId}
                    </td>
                    <td className="px-5 py-2.5 text-end tabular-nums">{line.rooms}</td>
                    <td className="px-5 py-2.5 text-end tabular-nums">
                      {formatAmount(line.rate, format.decimals)}
                    </td>
                    <td className="px-5 py-2.5 text-end tabular-nums">
                      {formatAmount(line.cost.amount, format.decimals)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {purchase.termination && (
          <Card>
            <CardHeader title="Terminated" />
            <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted text-xs">Termination date</dt>
                <dd className="text-foreground">{dayLabel(purchase.termination.terminationDate)}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">First released night</dt>
                <dd className="text-foreground">{dayLabel(purchase.termination.effectiveDate)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted text-xs">Reason</dt>
                <dd className="text-foreground whitespace-pre-line">{purchase.termination.reason}</dd>
              </div>
              {adjustments.map((adjustment) => (
                <div key={adjustment.id}>
                  <dt className="text-muted text-xs">
                    {adjustment.kind === 'penalty' ? 'Penalty paid' : 'Refund received'}
                  </dt>
                  <dd className="text-foreground tabular-nums">
                    {formatMoney(adjustment.amount.amount, {
                      symbol: adjustment.amount.currencyCode,
                      decimals: 2,
                    })}{' '}
                    <span className="text-muted text-xs">
                      ({formatMoney(adjustment.amount.amountPkr, PKR_FORMAT)})
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        <HistoryCard entity="purchase" entityId={id} money={format} />
      </div>

      {review && (
        <ImpactReviewDialog
          title={review.kind === 'cancel' ? `Cancel ${number}?` : `Restore ${number}?`}
          impact={review.impact}
          names={names}
          months={months}
          confirmLabel={review.kind === 'cancel' ? 'Cancel purchase' : 'Restore purchase'}
          canOverride={can('inventory.override_overbooking')}
          onConfirm={handleReview}
          onCancel={() => {
            setReview(null);
          }}
        />
      )}

      <ConfirmDialog
        open={pending === 'confirm'}
        onCancel={() => {
          setPending(null);
        }}
        onConfirm={() => void runAction()}
        title={`Confirm ${number}?`}
        confirmLabel="Confirm purchase"
        isBusy={isBusy}
      >
        {roomTotal} rooms for {nights} nights join the ledger at once. A confirmed purchase can no longer be
        edited here, only cancelled.
      </ConfirmDialog>
      <ConfirmDialog
        open={pending === 'delete'}
        onCancel={() => {
          setPending(null);
        }}
        onConfirm={() => void runAction()}
        title={`Delete ${number}?`}
        confirmLabel="Delete draft"
        tone="danger"
        isBusy={isBusy}
      >
        This draft is removed for good. Its number is not reused.
      </ConfirmDialog>
    </>
  );
}
