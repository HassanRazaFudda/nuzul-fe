import { useQuery, useSuspenseQueries } from '@tanstack/react-query';
import { Link } from 'react-router';

import { RECORD_LINK_CLASS } from '@/components/ui/buttonStyles';
import { Card } from '@/components/ui/Card';
import { currenciesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';
import { UnknownCost } from '@/features/inventory';
import { formatIsoDate } from '@/lib/format/dates';

import { contractProfitQuery } from '../api/report.queries';
import { reportParamsSchema } from '../api/report.schemas';
import { sumTotals, type ContractProfit } from '../domain/reports';
import { amountFormatter, asNumber } from '../components/money-format';
import { ReportFilters } from '../components/ReportFilters';
import { ReportShell } from '../components/ReportShell';
import { toSheet } from '../components/report-sheet';
import { ReportTable, type ReportColumn } from '../components/ReportTable';
import { useReportParams } from '../components/useReportParams';

type Row = ContractProfit & { agentName: string };

export function ContractProfitPage() {
  const { params, updateParams } = useReportParams(reportParamsSchema);
  const query = useQuery(contractProfitQuery(params));
  const [{ data: hotels }, { data: currencies }] = useSuspenseQueries({
    queries: [hotelOptionsQuery, currenciesQuery],
  });
  const amount = amountFormatter(currencies, params.currency);
  const decimals = currencies.find((item) => item.code === params.currency)?.decimals ?? 2;

  const columns: ReportColumn<Row>[] = [
    {
      header: 'Contract',
      cell: (row) =>
        row.contractId ? (
          <Link to={`/contracts/${row.contractId}`} className={RECORD_LINK_CLASS}>
            {row.number}
          </Link>
        ) : (
          row.number
        ),
      value: (row) => row.number,
    },
    { header: 'Agent', cell: (row) => row.agentName, value: (row) => row.agentName },
    {
      header: 'Signed',
      cell: (row) => (row.date ? formatIsoDate(row.date) : ''),
      value: (row) => row.date,
    },
    {
      header: 'Room-nights',
      isNumeric: true,
      cell: (row) => row.roomNights,
      value: (row) => asNumber(row.roomNights),
    },
    {
      header: 'Revenue, known portion',
      isNumeric: true,
      cell: (row) => amount(String(Number(row.revenueRoom) + Number(row.revenueMeal))),
      value: (row) => Number(row.revenueRoom) + Number(row.revenueMeal),
    },
    {
      header: 'Cost',
      isNumeric: true,
      cell: (row) => amount(String(Number(row.costRoom) + Number(row.costMeal))),
      value: (row) => Number(row.costRoom) + Number(row.costMeal),
    },
    {
      header: 'Profit, known portion',
      isNumeric: true,
      cell: (row) => amount(row.profitKnown),
      value: (row) => asNumber(row.profitKnown),
    },
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

  const rowsOf = (data: NonNullable<typeof query.data>): Row[] =>
    data.rows.map((row) => ({ ...row, agentName: data.names.agents[row.agentId] ?? row.agentId }));
  const totalOf = (rows: Row[]): Row => ({
    ...sumTotals(rows, decimals),
    contractId: '',
    number: 'Total',
    date: '',
    agentId: '',
    agentName: '',
  });

  return (
    <ReportShell
      currency={params.currency}
      title="Contract profitability"
      subtitle="Contracts signed in the period, over all their nights"
      query={query}
      fileName={`Contract profitability ${params.currency}.xlsx`}
      filters={
        <ReportFilters
          params={params}
          onChange={updateParams}
          hotels={hotels}
          currencies={currencies}
          periodLabel="Contract date"
          showHotel={false}
        />
      }
      sheets={(data) => {
        const rows = rowsOf(data);
        return [toSheet('Contracts', columns, rows, totalOf(rows))];
      }}
    >
      {(data) => {
        const rows = rowsOf(data);
        return (
          <Card>
            <ReportTable
              caption="Contract profitability"
              columns={columns}
              rows={rows}
              rowKey={(row) => row.contractId}
              footer={rows.length > 0 ? totalOf(rows) : undefined}
              empty="No confirmed contract was signed in this period"
            />
          </Card>
        );
      }}
    </ReportShell>
  );
}
