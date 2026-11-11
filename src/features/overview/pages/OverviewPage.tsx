import { useQuery, useSuspenseQueries } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, FileSignature, Plus, ShoppingCart } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Amount } from '@/components/ui/Amount';
import { buttonClass, FIGURE_LINK_CLASS, RECORD_LINK_CLASS } from '@/components/ui/buttonStyles';
import { Card, CardHeader } from '@/components/ui/Card';
import { Stat, SummaryStrip } from '@/components/ui/Stat';
import { calendarMonthsQuery, formatDay } from '@/features/calendar';
import { contractListQuery, ContractTags } from '@/features/contracts';
import { InventoryStateTag, seasonPoolsQuery, type PoolSummary } from '@/features/inventory';
import { purchaseListQuery } from '@/features/purchases';
import { profitAndLossQuery, salesParamsSchema, salesReportQuery } from '@/features/reports';
import { useCan } from '@/lib/auth/session';
import { cn } from '@/lib/cn';
import { formatIsoDate, isoDate, todayIso } from '@/lib/format/dates';
import { formatMoney } from '@/lib/money/money';

import { OccupancyChart } from '../components/OccupancyChart';

const SAR = { symbol: 'SAR', decimals: 2 };
const FIRST_FIVE = { page: 1, pageSize: 5, search: '', hotelId: '' };
const CARD_LINK =
  'text-muted hover:text-foreground inline-flex items-center gap-1 text-meta transition-colors duration-150';
const ROWS_SHOWN = 8;

type DayLabel = (iso: string) => string;

function useToday() {
  const [today] = useState(() => todayIso(new Date()));
  return today;
}

function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={CARD_LINK}>
      {children}
      <ArrowRight aria-hidden className="size-3.5" />
    </Link>
  );
}

/** Profit and unsold rooms across every stay, in SAR. Loads after the page, never blocks it. */
function MoneyFigures() {
  const on = useToday();
  const { data } = useQuery(
    profitAndLossQuery({ from: '', to: '', hotelId: '', currency: 'SAR', policy: 'transaction', on }),
  );
  return (
    <>
      <Stat
        label="Profit so far"
        value={
          data ? (
            <Link to="/profit-loss" className={FIGURE_LINK_CLASS}>
              {formatMoney(data.total.profitKnown, SAR)}
            </Link>
          ) : (
            '…'
          )
        }
        hint={data?.isPartial ? 'Partial: some sold nights are not purchased yet' : 'All stays'}
        {...(data?.total.profitKnown.startsWith('-') ? { tone: 'danger' as const } : {})}
      />
      <Stat
        label="Cost of unsold rooms"
        value={
          data ? (
            <Link to="/reports/exposure" className={FIGURE_LINK_CLASS}>
              {formatMoney(data.exposure, SAR)}
            </Link>
          ) : (
            '…'
          )
        }
        hint="Purchased, not yet sold"
      />
    </>
  );
}

interface AttentionItem {
  key: string;
  to: string;
  title: string;
  detail: string;
  tone: 'danger' | 'warning';
  action: string;
}

/**
 * The day's to-do list: every shortage and every draft, each with the one action that clears
 * it. Shortages first, because they cost money.
 */
function NeedsAttention({ pools }: { pools: PoolSummary[] }) {
  const can = useCan();
  const purchases = useQuery({
    ...purchaseListQuery({ ...FIRST_FIVE, status: 'draft', sortBy: 'number', sortDir: 'desc' }),
    enabled: can('purchase.view'),
  });
  const contracts = useQuery({
    ...contractListQuery({ ...FIRST_FIVE, status: 'draft', sortBy: 'date', sortDir: 'desc' }),
    enabled: can('contract.view'),
  });
  const drafts = (count: number, noun: string, to: string): AttentionItem[] =>
    count > 0
      ? [
          {
            key: to,
            to,
            title: `${String(count)} ${noun}${count === 1 ? '' : 's'} in draft`,
            detail: 'Not counted on the ledger until confirmed',
            tone: 'warning',
            action: 'Review',
          },
        ]
      : [];

  const items: AttentionItem[] = [
    ...pools
      .filter((pool) => pool.state === 'overbooked')
      .map((pool) => ({
        key: pool.id,
        to: `/inventory/${pool.hotelId}/${pool.roomTypeId}`,
        title: `${pool.hotelName} · ${pool.roomTypeName}`,
        detail: `Overbooked by ${String(pool.shortage)} ${pool.shortage === 1 ? 'room' : 'rooms'}`,
        tone: 'danger' as const,
        action: can('purchase.create') ? 'Buy rooms' : 'View',
      })),
    ...drafts(contracts.data?.counts.draft ?? 0, 'contract', '/contracts?status=draft'),
    ...drafts(purchases.data?.counts.draft ?? 0, 'purchase', '/purchases?status=draft'),
  ];

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader title="Needs attention" meta={items.length > 0 ? items.length : undefined} divided />
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
          <CheckCircle2 aria-hidden className="text-success size-6" />
          <p className="text-foreground text-sm font-medium">All clear</p>
          <p className="text-muted text-meta">Every night is covered and nothing waits in draft</p>
        </div>
      ) : (
        <ul className="divide-border-subtle divide-y">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                to={item.to}
                className="group hover:bg-surface-raised flex items-center gap-3 px-4 py-3 transition-colors duration-150"
              >
                <span
                  aria-hidden
                  className={cn(
                    'h-8 w-1 shrink-0 rounded-full',
                    item.tone === 'danger' ? 'bg-danger' : 'bg-warning',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block truncate text-sm font-medium">{item.title}</span>
                  <span
                    className={cn(
                      'text-meta block',
                      item.tone === 'danger' ? 'text-danger-strong' : 'text-muted',
                    )}
                  >
                    {item.detail}
                  </span>
                </span>
                <span className={cn(buttonClass('secondary', 'sm'), 'group-hover:border-faint')}>
                  {item.action}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Problems first, then what is left to sell, then what is sold out. */
function byUrgency(a: PoolSummary, b: PoolSummary) {
  const rank = { overbooked: 0, available: 1, full: 2 } as const;
  if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state];
  if (a.state === 'overbooked') return b.shortage - a.shortage;
  if (a.state === 'available') return b.lowestAvailable - a.lowestAvailable;
  return a.hotelName.localeCompare(b.hotelName);
}

/** How full each hotel and room type is, as a bar, with what can still be sold. */
function RoomsByHotel({ pools, dayLabel }: { pools: PoolSummary[]; dayLabel: DayLabel }) {
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();
  const sorted = pools.toSorted(byUrgency);
  const shown = showAll ? sorted : sorted.slice(0, ROWS_SHOWN);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Rooms by hotel"
        meta={pools.length > 0 ? pools.length : undefined}
        action={<CardLink to="/inventory">Rooms ledger</CardLink>}
        divided
      />
      {pools.length === 0 ? (
        <EmptyState title="No confirmed purchases yet" />
      ) : (
        <>
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Rooms by hotel and room type</caption>
              <thead>
                <tr className="bg-surface-raised text-muted text-xs">
                  <th scope="col" className="h-8 px-4 text-start font-medium">
                    Hotel and room type
                  </th>
                  <th scope="col" className="w-[38%] px-3 text-start font-medium">
                    Room-nights sold
                  </th>
                  <th scope="col" className="px-4 text-end font-medium">
                    Tightest night
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((pool) => {
                  const share =
                    pool.roomNightsPurchased > 0 ? pool.roomNightsSold / pool.roomNightsPurchased : 0;
                  const to = `/inventory/${pool.hotelId}/${pool.roomTypeId}`;
                  return (
                    <tr
                      key={pool.id}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest('a')) return;
                        void navigate(to);
                      }}
                      className="border-border-subtle hover:bg-surface-raised cursor-pointer border-t transition-colors duration-100"
                    >
                      <td className="px-4 py-2.5">
                        <Link to={to} className="text-foreground font-medium">
                          {pool.hotelName} · {pool.roomTypeName}
                        </Link>
                        <span className="text-muted block text-xs">
                          {dayLabel(pool.firstNight)} to {dayLabel(pool.lastCheckOut)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div
                            aria-hidden
                            className="bg-surface-muted relative h-1.5 min-w-16 flex-1 overflow-hidden rounded-full"
                          >
                            <div
                              className={cn(
                                'absolute inset-y-0 left-0 rounded-full',
                                pool.state === 'overbooked' ? 'bg-danger' : 'bg-secondary',
                              )}
                              style={{ width: `${String(Math.min(share, 1) * 100)}%` }}
                            />
                          </div>
                          <span className="text-secondary w-28 shrink-0 text-end text-xs whitespace-nowrap tabular-nums">
                            {pool.roomNightsSold.toLocaleString('en-GB')}
                            <span className="text-muted">
                              {' '}
                              / {pool.roomNightsPurchased.toLocaleString('en-GB')}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-end">
                        <InventoryStateTag state={pool.state} rooms={Math.abs(pool.lowestAvailable)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sorted.length > ROWS_SHOWN && (
            <button
              type="button"
              onClick={() => {
                setShowAll(!showAll);
              }}
              className="border-border-subtle text-muted hover:bg-surface-raised hover:text-foreground text-meta w-full border-t py-2.5 transition-colors duration-150"
            >
              {showAll ? 'Show fewer' : `Show all ${String(sorted.length)}`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}

/** Agents ranked by what they bought, across every confirmed contract. */
function TopAgents() {
  const on = useToday();
  const { data } = useQuery(salesReportQuery({ ...salesParamsSchema.parse({ groupBy: 'agent' }), on }));
  const rows = (data?.rows ?? []).toSorted((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5);
  const top = Number(rows[0]?.amount ?? 0);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Top agents"
        action={<CardLink to="/reports/sales?groupBy=agent">Sales report</CardLink>}
        divided
      />
      {!data ? (
        <p className="text-muted px-4 py-5 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted px-4 py-5 text-sm">No confirmed sales yet</p>
      ) : (
        <ol className="space-y-3.5 px-4 pt-3.5 pb-4">
          {rows.map((row, index) => (
            <li key={row.group}>
              <div className="flex items-baseline gap-2.5 text-sm">
                <span className="text-muted w-3 text-xs tabular-nums">{index + 1}</span>
                <span className="text-foreground min-w-0 flex-1 truncate">
                  {data.names.agents[row.group] ?? row.group}
                </span>
                <span className="font-medium">
                  <Amount amount={row.amount} currency={SAR} />
                </span>
              </div>
              <div className="ms-5.5 mt-1.5 flex items-center gap-3">
                <div aria-hidden className="bg-surface-muted h-1 flex-1 overflow-hidden rounded-full">
                  <div
                    className="bg-secondary/70 h-full rounded-full"
                    style={{ width: `${String(top > 0 ? (Number(row.amount) / top) * 100 : 0)}%` }}
                  />
                </div>
                <span className="text-muted text-xs whitespace-nowrap tabular-nums">
                  {row.contracts} {row.contracts === 1 ? 'contract' : 'contracts'} ·{' '}
                  {Number(row.roomNights).toLocaleString('en-GB')} rn
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function LatestContracts() {
  const navigate = useNavigate();
  const { data } = useQuery(
    contractListQuery({ ...FIRST_FIVE, status: 'confirmed', sortBy: 'date', sortDir: 'desc' }),
  );
  const contracts = data?.items ?? [];

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Latest contracts"
        action={<CardLink to="/contracts">All contracts</CardLink>}
        divided
      />
      {!data ? (
        <p className="text-muted px-4 py-5 text-sm">Loading…</p>
      ) : contracts.length === 0 ? (
        <p className="text-muted px-4 py-5 text-sm">No confirmed contracts yet</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Latest confirmed contracts</caption>
            <thead>
              <tr className="bg-surface-raised text-muted text-xs">
                <th scope="col" className="h-8 px-4 text-start font-medium">
                  Contract
                </th>
                <th scope="col" className="px-3 text-start font-medium">
                  Agent
                </th>
                <th scope="col" className="px-3 text-start font-medium">
                  Hotels
                </th>
                <th scope="col" className="px-3 text-start font-medium">
                  Signed
                </th>
                <th scope="col" className="px-4 text-end font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => (
                <tr
                  key={contract.id}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest('a')) return;
                    void navigate(`/contracts/${contract.id}`);
                  }}
                  className="border-border-subtle hover:bg-surface-raised cursor-pointer border-t transition-colors duration-100"
                >
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link to={`/contracts/${contract.id}`} className={RECORD_LINK_CLASS}>
                      {contract.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">{contract.agentName}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-secondary">
                        {[...new Set(contract.hotels.map((entry) => entry.hotelName))].join(', ')}
                      </span>
                      <ContractTags tags={contract.tags} />
                    </span>
                  </td>
                  <td className="text-muted px-3 py-2.5 whitespace-nowrap">{formatIsoDate(contract.date)}</td>
                  <td className="px-4 py-2.5 text-end">
                    <Amount
                      amount={contract.total.amount}
                      currency={{ symbol: contract.total.currencyCode, decimals: 2 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Legend() {
  return (
    <ul className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-xs">
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="bg-primary h-0.5 w-3.5 rounded-full" />
        Sold
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="bg-faint h-0.5 w-3.5 rounded-full" />
        Purchased
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="bg-primary-active ring-surface size-2 rounded-full ring-2" />
        Overbooked
      </li>
    </ul>
  );
}

function Dashboard({ actions }: { actions: ReactNode }) {
  const can = useCan();
  const [{ data: season }, { data: months }] = useSuspenseQueries({
    queries: [seasonPoolsQuery, calendarMonthsQuery],
  });
  const { pools, nights } = season;
  const dayLabel = (iso: string) => formatDay(iso, months);
  const purchased = pools.reduce((total, pool) => total + pool.roomNightsPurchased, 0);
  const sold = pools.reduce((total, pool) => total + pool.roomNightsSold, 0);
  const overbooked = pools.filter((pool) => pool.state === 'overbooked').length;
  const first = nights.at(0);
  const last = nights.at(-1);
  const seasonLine =
    first && last
      ? `Season ${dayLabel(isoDate(first.day))} to ${dayLabel(isoDate(last.day + 1))} · ${String(nights.length)} nights`
      : undefined;

  return (
    <>
      <PageHeader title="Overview" {...(seasonLine ? { subtitle: seasonLine } : {})} action={actions} />
      <PageBody>
        <SummaryStrip>
          <Stat
            label="Room-nights sold"
            value={sold.toLocaleString('en-GB')}
            {...(purchased > 0
              ? {
                  hint: `${String(Math.round((sold / purchased) * 100))}% of ${purchased.toLocaleString('en-GB')} purchased`,
                }
              : {})}
          />
          <Stat
            label="Left to sell"
            value={Math.max(purchased - sold, 0).toLocaleString('en-GB')}
            hint="Room-nights"
          />
          <Stat
            label="Overbooked"
            value={
              <Link to="/inventory?status=overbooked" className={FIGURE_LINK_CLASS}>
                {overbooked}
              </Link>
            }
            hint={`of ${String(pools.length)} hotel room types`}
            {...(overbooked > 0 ? { tone: 'danger' as const } : {})}
          />
          {can('report.view') && can('finance.view_cost') && <MoneyFigures />}
        </SummaryStrip>

        <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(20rem,1fr)_minmax(0,2fr)]">
          <NeedsAttention pools={pools} />
          <Card className="overflow-hidden">
            <CardHeader title="Occupancy by night" action={<Legend />} divided />
            {nights.length === 0 ? (
              <EmptyState title="No confirmed purchases yet" />
            ) : (
              <div className="pt-3 pb-4">
                <OccupancyChart nights={nights} dayLabel={dayLabel} />
              </div>
            )}
          </Card>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
          <RoomsByHotel pools={pools} dayLabel={dayLabel} />
          {can('report.view') && <TopAgents />}
        </div>

        {can('contract.view') && <LatestContracts />}
      </PageBody>
    </>
  );
}

export function OverviewPage() {
  const can = useCan();
  const actions = (
    <>
      {can('purchase.create') && (
        <Link to="/purchases/new" className={buttonClass('secondary')}>
          <ShoppingCart aria-hidden />
          New purchase
        </Link>
      )}
      {can('contract.create') && (
        <Link to="/contracts/new" className={buttonClass('primary')}>
          <FileSignature aria-hidden />
          New contract
        </Link>
      )}
    </>
  );

  if (!can('inventory.view')) {
    return (
      <>
        <PageHeader title="Overview" action={actions} />
        <PageBody>
          <Card>
            <EmptyState
              icon={<Plus aria-hidden className="size-6" />}
              title="Choose where to start from the menu"
            />
          </Card>
        </PageBody>
      </>
    );
  }
  return <Dashboard actions={actions} />;
}
