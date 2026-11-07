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
import { currenciesQuery } from '@/features/currencies';
import { roomTypesQuery } from '@/features/room-types';
import { getErrorMessage } from '@/lib/api/api-error';
import { formatIsoDate, nightsBetween } from '@/lib/format/dates';
import { formatMoney } from '@/lib/money/money';

import {
  purchaseDetailQuery,
  purchaseKeys,
  useCancelPurchase,
  useConfirmPurchase,
  useRemovePurchase,
} from '../api/purchase.queries';
import { CHARGE_BASIS_LABELS, MEAL_BASIS_LABELS } from '../components/meal-labels';
import { PurchaseStatusBadge } from '../components/PurchaseStatusBadge';

const PKR_FORMAT = { symbol: 'PKR', decimals: 2 };

type PendingAction = 'confirm' | 'cancel' | 'delete';

export function PurchaseDetailPage() {
  const { id = '' } = useParams();
  const { data: purchase } = useSuspenseQuery(purchaseDetailQuery(id));
  const [{ data: months }, { data: roomTypes }, { data: currencies }] = useSuspenseQueries({
    queries: [calendarMonthsQuery, roomTypesQuery, currenciesQuery],
  });
  const confirmPurchase = useConfirmPurchase();
  const cancelPurchase = useCancelPurchase();
  const removePurchase = useRemovePurchase();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

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
      } else if (pending === 'cancel') {
        await cancelPurchase.mutateAsync({ id, version });
        toast(`${number} cancelled`);
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

  const isBusy = confirmPurchase.isPending || cancelPurchase.isPending || removePurchase.isPending;

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
              <Button
                variant="secondary"
                onClick={() => {
                  setPending('cancel');
                }}
              >
                Cancel purchase
              </Button>
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
      </div>

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
        open={pending === 'cancel'}
        onCancel={() => {
          setPending(null);
        }}
        onConfirm={() => void runAction()}
        title={`Cancel ${number}?`}
        confirmLabel="Cancel purchase"
        tone="danger"
        isBusy={isBusy}
      >
        {roomTotal} rooms for {nights} nights leave the ledger. The purchase stays on record as Cancelled, and
        this cannot be undone.
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
