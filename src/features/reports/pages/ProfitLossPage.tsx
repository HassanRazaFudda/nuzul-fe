import { useQuery, useSuspenseQueries } from '@tanstack/react-query';
import { Link } from 'react-router';

import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { Card, CardHeader } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { currenciesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';
import { UnknownCost } from '@/features/inventory';

import { profitAndLossQuery } from '../api/report.queries';
import { reportParamsSchema } from '../api/report.schemas';
import type { Totals } from '../domain/reports';
import { asNumber, moneyFormatter } from '../components/money-format';
import { ReportFilters } from '../components/ReportFilters';
import { ReportShell } from '../components/ReportShell';
import { toSheet } from '../components/report-sheet';
import { ReportTable, type ReportColumn } from '../components/ReportTable';
import { useReportParams } from '../components/useReportParams';

type Row = Totals & { label: string };

function columnsFor(money: (amount: string) => string): ReportColumn<Row>[] {
  const figure = (header: string, field: keyof Totals, isMoney = true): ReportColumn<Row> => ({
    header,
    isNumeric: true,
    cell: (row) => (isMoney ? money(row[field]) : row[field]),
    value: (row) => asNumber(row[field]),
  });
  return [
    { header: 'Name', cell: (row) => row.label, value: (row) => row.label },
    figure('Room-nights', 'roomNights', false),
    figure('Room revenue', 'revenueRoom'),
    figure('Room cost', 'costRoom'),
    figure('Room margin', 'roomMargin'),
    figure('Meal income', 'revenueMeal'),
    figure('Meal cost', 'costMeal'),
    figure('Meal margin', 'mealMargin'),
    figure('Profit, known portion', 'profitKnown'),
    {
      header: 'Cost unknown',
      isNumeric: true,
      cell: (row) =>
        Number(row.unknownRoomNights) > 0 ? (
          <span className="inline-flex items-center gap-1">
            {row.unknownRoomNights} room-nights, {money(row.unknownRevenue)} <UnknownCost />
          </span>
        ) : (
          '—'
        ),
      value: (row) => asNumber(row.unknownRevenue),
    },
  ];
}

export function ProfitLossPage() {
  const { params, updateParams } = useReportParams(reportParamsSchema);
  const query = useQuery(profitAndLossQuery(params));
  const [{ data: hotels }, { data: currencies }] = useSuspenseQueries({
    queries: [hotelOptionsQuery, currenciesQuery],
  });
  const money = moneyFormatter(currencies, params.currency);
  const columns = columnsFor(money);
  const search = new URLSearchParams(
    Object.entries({
      from: params.from,
      to: params.to,
      hotelId: params.hotelId,
      currency: params.currency,
    }).filter(([, value]) => value !== ''),
  ).toString();

  return (
    <ReportShell
      title="Profit & loss"
      subtitle="By stay night: revenue and cost matched on the same night, at the weighted average cost"
      query={query}
      fileName={`Profit and loss ${params.currency}.xlsx`}
      filters={
        <ReportFilters
          params={params}
          onChange={updateParams}
          hotels={hotels}
          currencies={currencies}
          periodLabel="Stay nights"
        />
      }
      sheets={(data) => {
        const hotelRows = data.byHotel.map((row) => ({
          ...row,
          label: data.names.hotels[row.hotelId] ?? row.hotelId,
        }));
        const poolRows = data.byPool.map((row) => ({
          ...row,
          label: `${data.names.hotels[row.hotelId] ?? row.hotelId}, ${data.names.roomTypes[row.roomTypeId] ?? row.roomTypeId}`,
        }));
        return [
          toSheet('By hotel', columns, hotelRows, { ...data.total, label: 'Total' }),
          toSheet('By hotel and room type', columns, poolRows),
          {
            sheet: 'Summary',
            rows: [
              ['Item', `Amount (${params.currency})`],
              ['Profit, known portion', asNumber(data.total.profitKnown)],
              ['Termination adjustments', asNumber(data.adjustments)],
              ['Unsold exposure (memo)', asNumber(data.exposure)],
              ...(data.exchangeDifference === null
                ? []
                : [['Exchange difference (not realised)', asNumber(data.exchangeDifference)]]),
            ],
          },
        ];
      }}
    >
      {(data) => {
        const { total } = data;
        const hotelRows = data.byHotel.map((row) => ({
          ...row,
          label: data.names.hotels[row.hotelId] ?? row.hotelId,
        }));
        const poolRows = data.byPool.map((row) => ({
          ...row,
          label: `${data.names.hotels[row.hotelId] ?? row.hotelId}, ${data.names.roomTypes[row.roomTypeId] ?? row.roomTypeId}`,
        }));
        return (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="Profit on known portion"
                value={money(total.profitKnown)}
                hint={
                  data.isPartial
                    ? `Partial: ${total.unknownRoomNights} room-nights (revenue ${money(total.unknownRevenue)}) have no purchase`
                    : 'Every sold room-night has a purchase behind it'
                }
                {...(data.isPartial ? { tone: 'danger' as const } : {})}
              />
              <Stat
                label="Room margin"
                value={money(total.roomMargin)}
                hint={`${total.roomNights} room-nights`}
              />
              <Stat label="Meal margin" value={money(total.mealMargin)} />
              <Stat
                label="Termination adjustments"
                value={money(data.adjustments)}
                hint="Penalties paid less refunds received, dated in the period"
              />
            </div>

            {Number(total.mealMissingRoomNights) > 0 && (
              <ErrorNotice title="Meal cost missing">
                {total.mealMissingRoomNights} room-nights earn meal income with no meal bought for those
                nights, so the meal margin is overstated.
              </ErrorNotice>
            )}

            <Card>
              <CardHeader title="Memo" subtitle="Not part of the profit above" />
              <dl className="grid gap-x-6 gap-y-2 p-5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted text-xs">Unsold exposure</dt>
                  <dd className="text-foreground tabular-nums">
                    {money(data.exposure)}{' '}
                    <Link
                      to={`/reports/inventory${search ? `?${search}` : ''}`}
                      className="text-primary-strong text-xs underline print:hidden"
                    >
                      See unsold rooms
                    </Link>
                  </dd>
                </div>
                {data.exchangeDifference !== null && (
                  <div>
                    <dt className="text-muted text-xs">Exchange difference (not realised)</dt>
                    <dd className="text-foreground tabular-nums">{money(data.exchangeDifference)}</dd>
                  </div>
                )}
              </dl>
            </Card>

            <Card>
              <CardHeader title="By hotel" />
              <ReportTable
                caption="Profit and loss by hotel"
                columns={columns}
                rows={hotelRows}
                rowKey={(row) => row.label}
                footer={{ ...total, label: 'Total' }}
                empty="Nothing was sold for nights in this period."
              />
            </Card>
            <Card>
              <CardHeader title="By hotel and room type" subtitle="Room type as purchased" />
              <ReportTable
                caption="Profit and loss by hotel and room type"
                columns={columns}
                rows={poolRows}
                rowKey={(row) => row.label}
                empty="Nothing was sold for nights in this period."
              />
            </Card>
          </>
        );
      }}
    </ReportShell>
  );
}
