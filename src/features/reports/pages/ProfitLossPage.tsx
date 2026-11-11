import { useQuery, useSuspenseQueries } from '@tanstack/react-query';
import { Link } from 'react-router';

import { Callout } from '@/components/feedback/Callout';
import { Card, CardHeader } from '@/components/ui/Card';
import { Stat, SummaryStrip } from '@/components/ui/Stat';
import { currenciesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';
import { UnknownCost } from '@/features/inventory';

import { profitAndLossQuery } from '../api/report.queries';
import { reportParamsSchema } from '../api/report.schemas';
import type { Totals } from '../domain/reports';
import { amountFormatter, asNumber, moneyFormatter } from '../components/money-format';
import { ReportFilters } from '../components/ReportFilters';
import { ReportShell } from '../components/ReportShell';
import { toSheet } from '../components/report-sheet';
import { ReportTable, type ReportColumn } from '../components/ReportTable';
import { useReportParams } from '../components/useReportParams';

type Row = Totals & { label: string };

function columnsFor(amount: (value: string) => string): ReportColumn<Row>[] {
  const figure = (header: string, field: keyof Totals, isMoney = true): ReportColumn<Row> => ({
    header,
    isNumeric: true,
    cell: (row) => (isMoney ? amount(row[field]) : row[field]),
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
          <span className="inline-flex flex-col items-end">
            <UnknownCost />
            <span>{amount(row.unknownRevenue)}</span>
            <span className="text-muted text-xs">{row.unknownRoomNights} room-nights</span>
          </span>
        ) : (
          <span className="text-faint">—</span>
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
  const columns = columnsFor(amountFormatter(currencies, params.currency));
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
      currency={params.currency}
      title="Profit & loss"
      subtitle="By stay night, at the weighted average cost"
      footnote="Accounting rules pending review by the client's accountant"
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
            <SummaryStrip>
              <Stat
                label="Profit so far"
                value={money(total.profitKnown)}
                hint={
                  data.isPartial
                    ? `Partial: ${total.unknownRoomNights} room-nights have no purchase`
                    : 'Every sold room-night has a purchase'
                }
                {...(total.profitKnown.startsWith('-') ? { tone: 'danger' as const } : {})}
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
                hint="Penalties less refunds"
              />
              <Stat
                label="Cost of unsold rooms"
                value={
                  <Link
                    to={`/reports/exposure${search ? `?${search}` : ''}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {money(data.exposure)}
                  </Link>
                }
                hint="Memo, not part of the profit"
              />
              {data.exchangeDifference !== null && (
                <Stat
                  label="Exchange difference"
                  value={money(data.exchangeDifference)}
                  hint="Memo, not realised"
                />
              )}
            </SummaryStrip>

            {Number(total.mealMissingRoomNights) > 0 && (
              <Callout tone="warning" title="Meal margin is overstated">
                {total.mealMissingRoomNights} room-nights earn meal income with no meal bought for those
                nights.
              </Callout>
            )}

            <Card className="overflow-hidden">
              <CardHeader title="By hotel" divided />
              <ReportTable
                caption="Profit and loss by hotel"
                columns={columns}
                rows={hotelRows}
                rowKey={(row) => row.label}
                footer={{ ...total, label: 'Total' }}
                empty="Nothing was sold for nights in this period"
              />
            </Card>
            <Card className="overflow-hidden">
              <CardHeader title="By hotel and room type" subtitle="Room type as purchased" divided />
              <ReportTable
                caption="Profit and loss by hotel and room type"
                columns={columns}
                rows={poolRows}
                rowKey={(row) => row.label}
                empty="Nothing was sold for nights in this period"
              />
            </Card>
          </>
        );
      }}
    </ReportShell>
  );
}
