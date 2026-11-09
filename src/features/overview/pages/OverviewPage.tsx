import { useQuery, useSuspenseQueries } from '@tanstack/react-query';
import { ChevronRight, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Amount } from '@/components/ui/Amount';
import { buttonClass, FIGURE_LINK_CLASS, LINK_CLASS, RECORD_LINK_CLASS } from '@/components/ui/buttonStyles';
import { Card, CardHeader } from '@/components/ui/Card';
import { Stat, SummaryStrip } from '@/components/ui/Stat';
import { calendarMonthsQuery, formatDay } from '@/features/calendar';
import { contractListQuery, ContractTags } from '@/features/contracts';
import { InventoryStateTag, seasonPoolsQuery, type PoolSummary } from '@/features/inventory';
import { purchaseListQuery } from '@/features/purchases';
import { profitAndLossQuery, salesParamsSchema, salesReportQuery } from '@/features/reports';
import { useCan } from '@/lib/auth/session';
import { formatIsoDate, isoDate, todayIso } from '@/lib/format/dates';
import { formatMoney } from '@/lib/money/money';

import { OccupancyChart } from '../components/OccupancyChart';

const SAR = { symbol: 'SAR', decimals: 2 };
const FIRST_FIVE = { page: 1, pageSize: 5, search: '', hotelId: '' };
const CARD_LINK = `${LINK_CLASS} text-[0.8125rem]`;
const ROW = 'border-border hover:bg-background border-b transition-colors duration-150 last:border-b-0';

type DayLabel = (iso: string) => string;

function useToday() {
  const [today] = useState(() => todayIso(new Date()));
  return today;
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
        label="Profit, known portion"
        value={
          data ? (
            <Link to="/profit-loss" className={FIGURE_LINK_CLASS}>
              {formatMoney(data.total.profitKnown, SAR)}
            </Link>
          ) : (
            '…'
          )
        }
        hint={data?.isPartial ? 'Some sold nights have no purchase yet' : 'All stays'}
        {...(data?.total.profitKnown.startsWith('-') ? { tone: 'danger' as const } : {})}
      />
      <Stat
        label="Unsold exposure"
        value={
          data ? (
            <Link to="/reports/exposure" className={FIGURE_LINK_CLASS}>
              {formatMoney(data.exposure, SAR)}
            </Link>
          ) : (
            '…'
          )
        }
        hint="Purchased, not sold"
      />
    </>
  );
}

interface AttentionItem {
  key: string;
  to: string;
  title: string;
  detail: string;
  isProblem: boolean;
}

/** What someone should look at today: shortages first, then work left in draft. */
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
            title: `${String(count)} draft ${noun}${count === 1 ? '' : 's'}`,
            detail: 'Not on the ledger until confirmed',
            isProblem: false,
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
        isProblem: true,
      })),
    ...drafts(purchases.data?.counts.draft ?? 0, 'purchase', '/purchases?status=draft'),
    ...drafts(contracts.data?.counts.draft ?? 0, 'contract', '/contracts?status=draft'),
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Needs attention" />
      {items.length === 0 ? (
        <p className="text-muted px-5 pt-2 pb-5 text-sm">Every night is covered and nothing waits in draft</p>
      ) : (
        <ul className="divide-border mt-2 divide-y border-t">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                to={item.to}
                className="hover:bg-background flex items-center gap-3 px-5 py-3 transition-colors duration-150"
              >
                <span
                  aria-hidden
                  className={`size-2 shrink-0 rounded-full ${item.isProblem ? 'bg-danger' : 'bg-neutral'}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block truncate text-sm font-medium">{item.title}</span>
                  <span
                    className={`block text-[0.8125rem] ${item.isProblem ? 'text-danger-strong' : 'text-muted'}`}
                  >
                    {item.detail}
                  </span>
                </span>
                <ChevronRight aria-hidden className="text-faint size-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RoomsByHotel({ pools, dayLabel }: { pools: PoolSummary[]; dayLabel: DayLabel }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Rooms by hotel"
        action={
          <Link to="/inventory" className={CARD_LINK}>
            Rooms ledger
          </Link>
        }
      />
      {pools.length === 0 ? (
        <EmptyState title="No confirmed purchases yet" />
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Rooms by hotel and room type</caption>
            <thead>
              <tr className="border-border text-muted border-y text-xs">
                <th scope="col" className="h-9 ps-5 pe-3 text-start font-medium">
                  Hotel and room type
                </th>
                <th scope="col" className="px-3 text-end font-medium whitespace-nowrap">
                  Room-nights sold
                </th>
                <th scope="col" className="px-3 text-end font-medium">
                  Sold
                </th>
                <th scope="col" className="ps-3 pe-5 text-end font-medium">
                  State
                </th>
              </tr>
            </thead>
            <tbody>
              {pools.map((pool) => {
                const share =
                  pool.roomNightsPurchased > 0
                    ? Math.round((pool.roomNightsSold / pool.roomNightsPurchased) * 100)
                    : null;
                return (
                  <tr key={pool.id} className={ROW}>
                    <td className="py-3 ps-5 pe-3">
                      <Link
                        to={`/inventory/${pool.hotelId}/${pool.roomTypeId}`}
                        className="text-foreground font-medium hover:underline"
                      >
                        {pool.hotelName} · {pool.roomTypeName}
                      </Link>
                      <span className="text-muted block text-xs">
                        {dayLabel(pool.firstNight)} to {dayLabel(pool.lastCheckOut)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-end whitespace-nowrap tabular-nums">
                      {pool.roomNightsSold.toLocaleString('en-GB')}
                      <span className="text-muted">
                        {' '}
                        / {pool.roomNightsPurchased.toLocaleString('en-GB')}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-3 text-end tabular-nums ${share !== null && share > 100 ? 'text-danger-strong font-medium' : ''}`}
                    >
                      {share === null ? '—' : `${String(share)}%`}
                    </td>
                    <td className="py-3 ps-3 pe-5 text-end">
                      <InventoryStateTag state={pool.state} rooms={Math.abs(pool.lowestAvailable)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
        action={
          <Link to="/reports/sales?groupBy=agent" className={CARD_LINK}>
            Sales report
          </Link>
        }
      />
      {!data ? (
        <p className="text-muted px-5 pt-2 pb-5 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted px-5 pt-2 pb-5 text-sm">No confirmed sales yet</p>
      ) : (
        <ol className="space-y-4 px-5 pt-3 pb-5">
          {rows.map((row) => (
            <li key={row.group}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-foreground truncate">{data.names.agents[row.group] ?? row.group}</span>
                <Amount amount={row.amount} currency={SAR} />
              </div>
              <div aria-hidden className="bg-surface-muted mt-1.5 h-1 overflow-hidden rounded-full">
                <div
                  className="bg-secondary h-full rounded-full"
                  style={{ width: `${String(top > 0 ? (Number(row.amount) / top) * 100 : 0)}%` }}
                />
              </div>
              <p className="text-muted mt-1 text-xs tabular-nums">
                {row.contracts} {row.contracts === 1 ? 'contract' : 'contracts'},{' '}
                {Number(row.roomNights).toLocaleString('en-GB')} room-nights
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function LatestContracts() {
  const { data } = useQuery(
    contractListQuery({ ...FIRST_FIVE, status: 'confirmed', sortBy: 'date', sortDir: 'desc' }),
  );
  const contracts = data?.items ?? [];

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Latest contracts"
        action={
          <Link to="/contracts" className={CARD_LINK}>
            All contracts
          </Link>
        }
      />
      {!data ? (
        <p className="text-muted px-5 pt-2 pb-5 text-sm">Loading…</p>
      ) : contracts.length === 0 ? (
        <p className="text-muted px-5 pt-2 pb-5 text-sm">No confirmed contracts yet</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Latest confirmed contracts</caption>
            <thead>
              <tr className="border-border text-muted border-y text-xs">
                <th scope="col" className="h-9 ps-5 pe-3 text-start font-medium">
                  Contract
                </th>
                <th scope="col" className="px-3 text-start font-medium">
                  Agent
                </th>
                <th scope="col" className="px-3 text-start font-medium">
                  Hotels
                </th>
                <th scope="col" className="px-3 text-start font-medium">
                  Date
                </th>
                <th scope="col" className="ps-3 pe-5 text-end font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => (
                <tr key={contract.id} className={ROW}>
                  <td className="py-3 ps-5 pe-3 whitespace-nowrap">
                    <Link to={`/contracts/${contract.id}`} className={RECORD_LINK_CLASS}>
                      {contract.number}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{contract.agentName}</td>
                  <td className="px-3 py-3">
                    <span className="me-3">
                      {[...new Set(contract.hotels.map((entry) => entry.hotelName))].join(', ')}
                    </span>
                    <ContractTags tags={contract.tags} />
                  </td>
                  <td className="text-secondary px-3 py-3 whitespace-nowrap">
                    {formatIsoDate(contract.date)}
                  </td>
                  <td className="py-3 ps-3 pe-5 text-end">
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
        <svg aria-hidden width="16" height="2" className="overflow-visible">
          <line
            x1="0"
            x2="16"
            y1="1"
            y2="1"
            className="stroke-foreground"
            strokeWidth="2"
            strokeDasharray="5 3"
          />
        </svg>
        Purchased
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="bg-secondary/25 border-secondary h-2.5 w-4 border-t-[1.5px]" />
        Sold
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="bg-danger h-[3px] w-4 rounded-full" />
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
      ? `${dayLabel(isoDate(first.day))} to ${dayLabel(isoDate(last.day + 1))}, ${String(nights.length)} nights`
      : undefined;

  return (
    <>
      <PageHeader title="Overview" {...(seasonLine ? { subtitle: seasonLine } : {})} action={actions} />
      <div className="space-y-6 p-5 lg:p-8">
        <SummaryStrip>
          <Stat label="Room-nights purchased" value={purchased.toLocaleString('en-GB')} />
          <Stat
            label="Room-nights sold"
            value={sold.toLocaleString('en-GB')}
            {...(purchased > 0
              ? { hint: `${String(Math.round((sold / purchased) * 100))}% of purchased` }
              : {})}
          />
          <Stat
            label="Overbooked"
            value={
              <Link to="/inventory?status=overbooked" className={FIGURE_LINK_CLASS}>
                {overbooked}
              </Link>
            }
            hint={`of ${String(pools.length)} hotel and room types`}
            {...(overbooked > 0 ? { tone: 'danger' as const } : {})}
          />
          {can('report.view') && can('finance.view_cost') && <MoneyFigures />}
        </SummaryStrip>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <Card className="overflow-hidden">
            <CardHeader title="Occupancy by night" action={<Legend />} />
            {nights.length === 0 ? (
              <EmptyState title="No confirmed purchases yet" />
            ) : (
              <div className="pt-3 pb-4">
                <OccupancyChart nights={nights} dayLabel={dayLabel} />
              </div>
            )}
          </Card>
          <NeedsAttention pools={pools} />
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <RoomsByHotel pools={pools} dayLabel={dayLabel} />
          {can('report.view') && <TopAgents />}
        </div>

        {can('contract.view') && <LatestContracts />}
      </div>
    </>
  );
}

export function OverviewPage() {
  const can = useCan();
  const actions = (
    <>
      {can('purchase.create') && (
        <Link to="/purchases/new" className={buttonClass('secondary')}>
          <Plus aria-hidden className="size-4" />
          Add purchase
        </Link>
      )}
      {can('contract.create') && (
        <Link to="/contracts/new" className={buttonClass('primary')}>
          <Plus aria-hidden className="size-4" />
          Add contract
        </Link>
      )}
    </>
  );

  if (!can('inventory.view')) {
    return (
      <>
        <PageHeader title="Overview" action={actions} />
        <div className="p-5 lg:p-8">
          <Card>
            <EmptyState title="Choose where to start from the menu" />
          </Card>
        </div>
      </>
    );
  }
  return <Dashboard actions={actions} />;
}
