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
import { ledgerSourcesQuery, unallocatedBlocks } from '@/features/inventory';
import { conversionRulesQuery, roomTypesQuery } from '@/features/room-types';
import { getErrorMessage } from '@/lib/api/api-error';
import { formatIsoDate, nightsBetween } from '@/lib/format/dates';
import { formatMoney } from '@/lib/money/money';

import {
  contractContextQuery,
  contractDetailQuery,
  contractKeys,
  useCancelContract,
  useConfirmContract,
  useRemoveContract,
} from '../api/contract.queries';
import { ContractStatusBadge } from '../components/ContractStatusBadge';
import { ContractTags } from '../components/ContractTags';
import { MEAL_PLAN_LABELS } from '../components/meal-plan-labels';
import { OverbookingList } from '../components/OverbookingList';
import { contractImpact } from '../domain/contract-change';
import { overbookingPreview, type OverbookingPreview } from '../domain/overbooking';

const PKR_FORMAT = { symbol: 'PKR', decimals: 2 };
const NO_SHORTAGE: OverbookingPreview = { shortages: [], suggestions: [] };

type PendingAction = 'confirm' | 'delete';

export function ContractDetailPage() {
  const { id = '' } = useParams();
  const { data: contract } = useSuspenseQuery(contractDetailQuery(id));
  const [{ data: months }, { data: roomTypes }, { data: rules }, { data: currencies }] = useSuspenseQueries({
    queries: [calendarMonthsQuery, roomTypesQuery, conversionRulesQuery, currenciesQuery],
  });
  const confirmContract = useConfirmContract();
  const cancelContract = useCancelContract();
  const removeContract = useRemoveContract();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [preview, setPreview] = useState(NO_SHORTAGE);
  const [actionError, setActionError] = useState<unknown>(null);
  const [trimmedRooms, setTrimmedRooms] = useState(0);
  const [cancelImpact, setCancelImpact] = useState<Impact | null>(null);

  const { number, status, version, mealPlan, currencyCode } = contract;
  const format = currencies.find((item) => item.code === currencyCode) ?? {
    symbol: currencyCode,
    decimals: 2,
  };
  const typeName = (typeId: string) => roomTypes.find((type) => type.id === typeId)?.name ?? typeId;
  const hotelName = (hotelId: string) =>
    contract.hotels.find((entry) => entry.hotelId === hotelId)?.hotelName ?? hotelId;
  const range = (checkIn: string, checkOut: string) =>
    `${formatDay(checkIn, months)} to ${formatDay(checkOut, months)}`;
  const isBusy = confirmContract.isPending || removeContract.isPending;

  /** Checks against the records as they are now, not as they were when the page opened. */
  async function startConfirm() {
    setActionError(null);
    try {
      const context = await queryClient.query(contractContextQuery(id));
      setPreview(
        overbookingPreview(
          contract.hotels.flatMap((entry) =>
            entry.lines.map((line) => ({
              hotelId: entry.hotelId,
              soldAsTypeId: line.soldAsTypeId,
              sourceTypeId: line.sourceTypeId,
              checkIn: entry.checkIn,
              checkOut: entry.checkOut,
              rooms: line.rooms,
            })),
          ),
          { purchases: context.purchases, sales: context.sales, rules, roomTypes },
        ),
      );
      setPending('confirm');
    } catch (error) {
      setActionError(error);
    }
  }

  async function runAction() {
    setActionError(null);
    try {
      if (pending === 'confirm') {
        const result = await confirmContract.mutateAsync({ id, version });
        setTrimmedRooms(result.trimmedRooms);
        toast(`${number} confirmed`);
      } else if (pending === 'delete') {
        await removeContract.mutateAsync({ id, version });
        toast(`${number} deleted`);
        await navigate('/contracts?status=draft');
        queryClient.removeQueries({ queryKey: contractKeys.detail(id) });
      }
    } catch (error) {
      setActionError(error);
    }
    setPending(null);
  }

  /** Cancelling only frees rooms, but the preview still shows where. */
  async function startCancel() {
    setActionError(null);
    try {
      const sources = await queryClient.query(ledgerSourcesQuery);
      setCancelImpact(contractImpact(sources, contract, null));
    } catch (error) {
      setActionError(error);
    }
  }

  async function handleCancel(reason: string) {
    await cancelContract.mutateAsync({ id, version, reason });
    toast(`${number} cancelled`);
    setCancelImpact(null);
  }

  const isOverbooking = preview.shortages.length > 0;

  return (
    <>
      <PageHeader
        title={number}
        subtitle={`${contract.agentName}, ${formatIsoDate(contract.date)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ContractTags tags={contract.tags} />
            <ContractStatusBadge status={status} />
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
                <Link to={`/contracts/${id}/edit`} className={buttonClass('secondary')}>
                  Edit
                </Link>
                <Button onClick={() => void startConfirm()}>Confirm</Button>
              </>
            )}
            {status === 'confirmed' && (
              <>
                <Button variant="ghost" onClick={() => void startCancel()}>
                  Cancel contract
                </Button>
                <Link to={`/contracts/${id}/edit`} className={buttonClass('secondary')}>
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
        {trimmedRooms > 0 && (
          <ErrorNotice title="Some rooms lost their vendor">
            A vendor&apos;s free rooms went to another sale before this one was confirmed. {trimmedRooms}{' '}
            {trimmedRooms === 1 ? 'room is' : 'rooms are'} now unallocated. The contract is confirmed.
          </ErrorNotice>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Rooms" value={formatMoney(contract.roomAmount.amount, format)} />
          <Stat
            label="Meals"
            value={formatMoney(contract.mealIncome.amount, format)}
            hint={
              mealPlan.kind === 'none'
                ? 'No meal plan'
                : `${MEAL_PLAN_LABELS[mealPlan.kind]}, ${formatMoney(mealPlan.rate, format)} per person per night`
            }
          />
          <Stat
            label="Grand total"
            value={formatMoney(contract.total.amount, format)}
            hint={`${formatMoney(contract.total.amountPkr, PKR_FORMAT)} at 1 ${currencyCode} = ${contract.rateToPkr} PKR`}
          />
        </div>

        {contract.hotels.map((entry, index) => (
          <Card key={`${entry.hotelId}-${String(index)}`}>
            <CardHeader
              title={entry.hotelName}
              subtitle={`${range(entry.checkIn, entry.checkOut)}, ${String(nightsBetween(entry.checkIn, entry.checkOut))} nights. Rate is ${entry.perNight ? 'per night' : 'for the whole stay'}.`}
              action={
                <span className="text-foreground text-sm font-semibold tabular-nums">
                  {formatMoney(entry.total.amount, format)}
                </span>
              }
            />
            {entry.noMeals && mealPlan.kind !== 'none' && (
              <p className="px-5 pt-3">
                <Badge>No meals at this hotel</Badge>
              </p>
            )}
            <ul className="divide-border divide-y">
              {entry.lines.map((line, lineIndex) => {
                const unallocated = unallocatedBlocks(entry, line.rooms, line.allocations);
                return (
                  <li key={lineIndex} className="space-y-1.5 px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-foreground">
                        <span className="font-medium">
                          {line.rooms} {typeName(line.soldAsTypeId)}
                        </span>
                        {line.sourceTypeId !== line.soldAsTypeId && (
                          <span className="text-muted"> from {typeName(line.sourceTypeId)}</span>
                        )}
                        <span className="text-muted">
                          , {line.personsPerRoom} persons per room, at {formatMoney(line.rate, format)}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <ContractTags tags={line.tags} />
                        <span className="text-foreground tabular-nums">
                          {formatMoney(line.roomAmount.amount, format)}
                        </span>
                      </span>
                    </div>
                    {line.mealIncome.amount !== formatMoneyZero(format.decimals) && (
                      <p className="text-muted text-xs tabular-nums">
                        Meals {formatMoney(line.mealIncome.amount, format)}
                      </p>
                    )}
                    <ul className="text-muted space-y-0.5 text-xs">
                      {line.allocations.map((allocation) => (
                        <li key={`${allocation.purchaseId}-${allocation.checkIn}`}>
                          {allocation.vendorName},{' '}
                          <Link
                            to={`/purchases/${allocation.purchaseId}`}
                            className="text-primary-strong underline"
                          >
                            {allocation.number}
                          </Link>
                          : {allocation.rooms} rooms, {range(allocation.checkIn, allocation.checkOut)}
                        </li>
                      ))}
                      {unallocated.map((block) => (
                        <li key={block.checkIn} className="text-warning-strong">
                          Unallocated: {block.rooms} {block.rooms === 1 ? 'room' : 'rooms'},{' '}
                          {range(block.checkIn, block.checkOut)}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}

        {contract.notes && (
          <Card>
            <CardHeader title="Notes" />
            <p className="text-foreground p-5 text-sm whitespace-pre-line">{contract.notes}</p>
          </Card>
        )}

        <HistoryCard entity="contract" entityId={id} money={format} />
      </div>

      <ConfirmDialog
        open={pending === 'confirm'}
        onCancel={() => {
          setPending(null);
        }}
        onConfirm={() => void runAction()}
        title={isOverbooking ? `${number} would overbook` : `Confirm ${number}?`}
        confirmLabel={isOverbooking ? 'Confirm with overbooking' : 'Confirm contract'}
        cancelLabel={isOverbooking ? 'Go back' : 'Cancel'}
        tone={isOverbooking ? 'danger' : 'default'}
        isBusy={isBusy}
      >
        {isOverbooking ? (
          <OverbookingList preview={preview} hotelName={hotelName} roomTypes={roomTypes} months={months} />
        ) : (
          'These rooms join the ledger at once. A confirmed contract can no longer be edited here, only cancelled.'
        )}
      </ConfirmDialog>
      {cancelImpact && (
        <ImpactReviewDialog
          title={`Cancel ${number}?`}
          impact={cancelImpact}
          names={{ hotelName, roomTypeName: typeName }}
          months={months}
          confirmLabel="Cancel contract"
          onConfirm={handleCancel}
          onCancel={() => {
            setCancelImpact(null);
          }}
        />
      )}
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

const formatMoneyZero = (decimals: number) => (0).toFixed(decimals);
