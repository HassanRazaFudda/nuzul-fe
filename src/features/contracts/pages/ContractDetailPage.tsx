import { useQueryClient, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { Check, Lock, LockOpen, Pencil, Printer, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Callout } from '@/components/feedback/Callout';
import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { toast } from '@/components/feedback/toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { buttonClass, RECORD_LINK_CLASS } from '@/components/ui/buttonStyles';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Menu } from '@/components/ui/Menu';
import { Stat, SummaryStrip } from '@/components/ui/Stat';
import { calendarMonthsQuery, formatDay } from '@/features/calendar';
import { HistoryCard, ImpactReviewDialog, type Impact } from '@/features/changes';
import { currenciesQuery } from '@/features/currencies';
import { ledgerSourcesQuery, unallocatedBlocks } from '@/features/inventory';
import { conversionRulesQuery, roomTypesQuery } from '@/features/room-types';
import { getErrorMessage } from '@/lib/api/api-error';
import { useCan } from '@/lib/auth/session';
import { formatIsoDate, nightsBetween } from '@/lib/format/dates';
import { formatMoney } from '@/lib/money/money';

import {
  contractContextQuery,
  contractDetailQuery,
  contractKeys,
  useCancelContract,
  useRestoreContract,
  useSetContractLocked,
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
  const restoreContract = useRestoreContract();
  const setLocked = useSetContractLocked();
  const can = useCan();
  const removeContract = useRemoveContract();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [preview, setPreview] = useState(NO_SHORTAGE);
  const [actionError, setActionError] = useState<unknown>(null);
  const [trimmedRooms, setTrimmedRooms] = useState(0);
  const [review, setReview] = useState<{ kind: 'cancel' | 'restore'; impact: Impact; stamp: string } | null>(
    null,
  );

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
  const roomCount = contract.hotels.reduce(
    (total, entry) => total + entry.lines.reduce((sum, line) => sum + line.rooms, 0),
    0,
  );

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

  /** Works out what cancelling or restoring does, from the records as they are now. */
  async function startReview(kind: 'cancel' | 'restore') {
    setActionError(null);
    try {
      const sources = await queryClient.query(ledgerSourcesQuery);
      setReview({
        kind,
        impact: contractImpact(sources, contract, kind === 'cancel' ? null : contract.hotels),
        stamp: sources.stamp,
      });
    } catch (error) {
      setActionError(error);
    }
  }

  async function handleReview(reason: string) {
    if (!review) return;
    if (review.kind === 'cancel') {
      await cancelContract.mutateAsync({ id, version, reason });
      toast(`${number} cancelled`);
    } else {
      const result = await restoreContract.mutateAsync({ id, version, reason, stamp: review.stamp });
      setTrimmedRooms(result.trimmedRooms);
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

  const isOverbooking = preview.shortages.length > 0;
  // Each overbooked hotel and room type once, so the callout offers one fix per pool.
  const problemPools = [
    ...new Map(
      contract.hotels.flatMap((entry) =>
        entry.lines
          .filter((line) => line.tags.overbooked)
          .map((line) => {
            const to = `/inventory/${entry.hotelId}/${line.sourceTypeId}`;
            return [to, { to, label: `${entry.hotelName} ${typeName(line.sourceTypeId)}` }] as const;
          }),
      ),
    ).values(),
  ];
  const canOverride = can('inventory.override_overbooking');

  return (
    <>
      <PageHeader
        title={number}
        breadcrumbs={[{ label: 'Sales contracts', to: `/contracts?status=${status}` }]}
        subtitle={
          <>
            <span className="text-foreground font-medium">{contract.agentName}</span> · signed{' '}
            {formatIsoDate(contract.date)}
          </>
        }
        status={
          <>
            <ContractStatusBadge status={status} />
            <ContractTags tags={contract.tags} />
          </>
        }
        action={
          <>
            <Menu
              label={`More actions for ${number}`}
              items={[
                status === 'draft' &&
                  can('contract.delete') && {
                    label: 'Delete draft',
                    icon: <Trash2 aria-hidden />,
                    tone: 'danger',
                    onSelect: () => {
                      setPending('delete');
                    },
                  },
                status === 'confirmed' &&
                  can('contract.unlock') && {
                    label: 'Lock',
                    icon: <Lock aria-hidden />,
                    hint: 'No one can change it until unlocked',
                    onSelect: () => {
                      handleLock(true);
                    },
                  },
                status === 'confirmed' &&
                  can('contract.delete') && {
                    label: 'Cancel contract',
                    icon: <XCircle aria-hidden />,
                    hint: 'Its rooms go back to the pools',
                    tone: 'danger',
                    onSelect: () => void startReview('cancel'),
                  },
              ]}
            />
            <Link to={`/contracts/${id}/print`} className={buttonClass('secondary')}>
              <Printer aria-hidden />
              Print
            </Link>
            {status === 'draft' && (
              <>
                {can('contract.edit') && (
                  <Link to={`/contracts/${id}/edit`} className={buttonClass('secondary')}>
                    <Pencil aria-hidden />
                    Edit
                  </Link>
                )}
                {can('contract.confirm') && (
                  <Button icon={<Check aria-hidden />} onClick={() => void startConfirm()}>
                    Confirm
                  </Button>
                )}
              </>
            )}
            {status === 'confirmed' && can('contract.edit') && (
              <Link to={`/contracts/${id}/edit`} className={buttonClass('primary')}>
                <Pencil aria-hidden />
                Edit
              </Link>
            )}
            {status === 'locked' && can('contract.unlock') && (
              <Button
                variant="secondary"
                icon={<LockOpen aria-hidden />}
                isLoading={setLocked.isPending}
                onClick={() => {
                  handleLock(false);
                }}
              >
                Unlock
              </Button>
            )}
            {status === 'cancelled' && can('contract.edit') && (
              <Button variant="secondary" onClick={() => void startReview('restore')}>
                Restore
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-5 px-(--page-gutter) pt-4 pb-10">
        {status === 'draft' && (
          <Callout tone="neutral" title="Draft: these rooms are not on the ledger yet">
            Check the hotels and rooms below, then confirm to take them from the pools.
          </Callout>
        )}
        {status !== 'cancelled' && problemPools.length > 0 && (
          <Callout
            tone="danger"
            title={
              problemPools.length === 1
                ? 'A room type on this contract is overbooked'
                : `${String(problemPools.length)} room types on this contract are overbooked`
            }
            action={problemPools.map((pool) => (
              <Link key={pool.to} to={pool.to} className={buttonClass('secondary', 'sm')}>
                {can('purchase.create') ? 'Buy rooms' : 'View'}: {pool.label}
              </Link>
            ))}
          >
            More rooms are sold than purchased on some nights. Buying the missing rooms clears the flag.
          </Callout>
        )}
        {status !== 'cancelled' && contract.tags.needsVendor && (
          <Callout
            tone="warning"
            title="Some rooms have no vendor yet"
            action={
              (status === 'confirmed' || status === 'draft') &&
              can('contract.edit') && (
                <Link to={`/contracts/${id}/edit`} className={buttonClass('secondary', 'sm')}>
                  Assign vendors
                </Link>
              )
            }
          >
            Their cost stays unknown until a purchase is assigned to them.
          </Callout>
        )}
        {actionError !== null && (
          <ErrorNotice title="This could not be done">{getErrorMessage(actionError)}</ErrorNotice>
        )}
        {trimmedRooms > 0 && (
          <ErrorNotice title="Some rooms lost their vendor">
            A vendor&apos;s free rooms went to another sale before this one was confirmed. {trimmedRooms}{' '}
            {trimmedRooms === 1 ? 'room is' : 'rooms are'} now unallocated. The contract is confirmed.
          </ErrorNotice>
        )}

        <SummaryStrip>
          <Stat
            label="Rooms"
            value={formatMoney(contract.roomAmount.amount, format)}
            hint={`${String(roomCount)} ${roomCount === 1 ? 'room' : 'rooms'} in ${String(contract.hotels.length)} ${contract.hotels.length === 1 ? 'hotel' : 'hotels'}`}
          />
          {mealPlan.kind === 'none' ? (
            <Stat label="Meals" value="None" hint="No meal plan on this contract" />
          ) : (
            <Stat
              label="Meals"
              value={formatMoney(contract.mealIncome.amount, format)}
              hint={`${MEAL_PLAN_LABELS[mealPlan.kind]}, ${formatMoney(mealPlan.rate, format)} per person per night`}
            />
          )}
          <Stat
            label="Grand total"
            value={formatMoney(contract.total.amount, format)}
            hint={`${formatMoney(contract.total.amountPkr, PKR_FORMAT)} at 1 ${currencyCode} = ${contract.rateToPkr} PKR`}
          />
        </SummaryStrip>

        {contract.hotels.map((entry, index) => (
          <Card key={`${entry.hotelId}-${String(index)}`}>
            <CardHeader
              title={entry.hotelName}
              subtitle={`${range(entry.checkIn, entry.checkOut)} · ${String(nightsBetween(entry.checkIn, entry.checkOut))} nights · rate ${entry.perNight ? 'per night' : 'for the whole stay'}${entry.noMeals && mealPlan.kind !== 'none' ? ' · no meals here' : ''}`}
              action={
                <span className="text-foreground text-[0.9375rem] font-semibold tabular-nums">
                  {formatMoney(entry.total.amount, format)}
                </span>
              }
            />
            <ul className="divide-border-subtle border-border divide-y border-t">
              {entry.lines.map((line, lineIndex) => {
                const unallocated = unallocatedBlocks(entry, line.rooms, line.allocations);
                return (
                  <li key={lineIndex} className="space-y-1.5 px-4 py-3 text-sm">
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
                          <Link to={`/purchases/${allocation.purchaseId}`} className={RECORD_LINK_CLASS}>
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
            <p className="text-foreground px-4 pb-4 text-sm whitespace-pre-line">{contract.notes}</p>
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
        isConfirmDisabled={isOverbooking && !canOverride}
      >
        {isOverbooking ? (
          <>
            <OverbookingList preview={preview} hotelName={hotelName} roomTypes={roomTypes} months={months} />
            {!canOverride && (
              <p className="text-danger-strong mt-2">
                Going ahead with overbooking needs a permission you do not hold, so this stays a Draft.
              </p>
            )}
          </>
        ) : (
          'These rooms join the ledger at once. A confirmed contract can no longer be edited here, only cancelled.'
        )}
      </ConfirmDialog>
      {review && (
        <ImpactReviewDialog
          title={review.kind === 'cancel' ? `Cancel ${number}?` : `Restore ${number}?`}
          impact={review.impact}
          names={{ hotelName, roomTypeName: typeName }}
          months={months}
          confirmLabel={review.kind === 'cancel' ? 'Cancel contract' : 'Restore contract'}
          canOverride={canOverride}
          onConfirm={handleReview}
          onCancel={() => {
            setReview(null);
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
