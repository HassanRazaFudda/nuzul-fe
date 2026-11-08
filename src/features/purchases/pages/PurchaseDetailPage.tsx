import { useQueryClient, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { toast } from '@/components/feedback/toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Stat } from '@/components/ui/Stat';
import { calendarMonthsQuery, formatDay } from '@/features/calendar';
import { HistoryCard, ImpactReviewDialog, type Impact } from '@/features/changes';
import { currenciesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';
import { ledgerSourcesQuery } from '@/features/inventory';
import { roomTypesQuery } from '@/features/room-types';
import { getErrorMessage } from '@/lib/api/api-error';
import { formatIsoDate, nightsBetween } from '@/lib/format/dates';
import { formatMoney } from '@/lib/money/money';

import {
  adjustmentsQuery,
  purchaseDetailQuery,
  purchaseKeys,
  useCancelPurchase,
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
  const removePurchase = useRemovePurchase();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [cancelReview, setCancelReview] = useState<{ impact: Impact; stamp: string } | null>(null);

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
  async function startCancel() {
    setActionError(null);
    try {
      const sources = await queryClient.query(ledgerSourcesQuery);
      setCancelReview({ impact: purchaseImpact(sources, id, null), stamp: sources.stamp });
    } catch (error) {
      setActionError(error);
    }
  }

  async function handleCancel(reason: string) {
    if (!cancelReview) return;
    await cancelPurchase.mutateAsync({ id, version, reason, stamp: cancelReview.stamp });
    toast(`${number} cancelled`);
    setCancelReview(null);
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
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PurchaseStatusBadge status={status} />
            {status === 'draft' && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPending('delete');
                  }}
                >
                  Delete
                </Button>
                <Link to={`/purchases/${id}/edit`} className={buttonClass('secondary')}>
                  Edit
                </Link>
                <Button
                  onClick={() => {
                    setPending('confirm');
                  }}
                >
                  Confirm
                </Button>
              </>
            )}
            {status === 'confirmed' && (
              <>
                <Button variant="ghost" onClick={() => void startCancel()}>
                  Cancel purchase
                </Button>
                <Link to={`/purchases/${id}/terminate`} className={buttonClass('secondary')}>
                  Terminate
                </Link>
                <Link to={`/purchases/${id}/edit`} className={buttonClass('secondary')}>
                  Edit
                </Link>
              </>
            )}
          </div>
        }
      />
      <div className="space-y-5 p-5 lg:p-8">
        {actionError !== null && (
          <ErrorNotice title="This could not be done">{getErrorMessage(actionError)}</ErrorNotice>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Nights" value={nights} hint={`${String(roomTotal)} rooms`} />
          <Stat label="Room cost" value={formatMoney(purchase.roomCost.amount, format)} />
          <Stat label="Meal cost" value={formatMoney(purchase.mealCost.amount, format)} />
          <Stat
            label="Total"
            value={formatMoney(purchase.total.amount, format)}
            hint={formatMoney(purchase.total.amountPkr, PKR_FORMAT)}
          />
        </div>

        <Card>
          <CardHeader title="Stay" />
          <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted text-xs">Check-in</dt>
              <dd className="text-foreground">{dayLabel(purchase.checkIn)}</dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Check-out</dt>
              <dd className="text-foreground">{dayLabel(purchase.checkOut)}</dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Rate against PKR</dt>
              <dd className="text-foreground tabular-nums">
                1 {currencyCode} = {purchase.rateToPkr} PKR
              </dd>
            </div>
            <div>
              <dt className="text-muted text-xs">Rate is</dt>
              <dd className="text-foreground">{purchase.perNight ? 'Per night' : 'For the whole stay'}</dd>
            </div>
            {purchase.notes && (
              <div className="sm:col-span-2">
                <dt className="text-muted text-xs">Notes</dt>
                <dd className="text-foreground whitespace-pre-line">{purchase.notes}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Room lines" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Room lines</caption>
              <thead>
                <tr className="text-muted text-xs">
                  <th scope="col" className="px-5 py-2 text-start font-semibold">
                    Room type
                  </th>
                  <th scope="col" className="px-5 py-2 text-end font-semibold">
                    Rooms
                  </th>
                  <th scope="col" className="px-5 py-2 text-end font-semibold">
                    Cost rate
                  </th>
                  <th scope="col" className="px-5 py-2 text-end font-semibold">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {purchase.lines.map((line) => (
                  <tr key={line.roomTypeId} className="border-border text-foreground border-t">
                    <td className="px-5 py-2">
                      {roomTypes.find((type) => type.id === line.roomTypeId)?.name ?? line.roomTypeId}
                    </td>
                    <td className="px-5 py-2 text-end tabular-nums">{line.rooms}</td>
                    <td className="px-5 py-2 text-end tabular-nums">{formatMoney(line.rate, format)}</td>
                    <td className="px-5 py-2 text-end tabular-nums">
                      {formatMoney(line.cost.amount, format)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Meals" />
          <div className="text-foreground p-5 text-sm">
            {meal.pricing === 'none' && 'No meals on this purchase.'}
            {meal.pricing === 'included' && <Badge tone="brand">Includes meal</Badge>}
            {meal.pricing === 'separate' && (
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-muted text-xs">Meal rate</dt>
                  <dd className="tabular-nums">
                    {formatMoney(meal.rate, format)}, {MEAL_BASIS_LABELS[meal.basis].toLowerCase()}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted text-xs">Charge basis</dt>
                  <dd>{CHARGE_BASIS_LABELS[meal.chargeBasis]}</dd>
                </div>
                {purchase.mealMaximum !== null && (
                  <div>
                    <dt className="text-muted text-xs">Meal, at most (not in the total)</dt>
                    <dd className="tabular-nums">{formatMoney(purchase.mealMaximum, format)}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </Card>

        {purchase.termination && (
          <Card>
            <CardHeader
              title="Terminated"
              subtitle="Rooms count on the ledger only before the effective date"
            />
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

      {cancelReview && (
        <ImpactReviewDialog
          title={`Cancel ${number}?`}
          impact={cancelReview.impact}
          names={names}
          months={months}
          confirmLabel="Cancel purchase"
          onConfirm={handleCancel}
          onCancel={() => {
            setCancelReview(null);
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
