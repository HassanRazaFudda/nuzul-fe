import { useQuery, useSuspenseQueries } from '@tanstack/react-query';

import { Card } from '@/components/ui/Card';
import { currenciesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';

import { vendorMarginQuery } from '../api/report.queries';
import { reportParamsSchema } from '../api/report.schemas';
import type { VendorMargin } from '../domain/reports';
import { asNumber, moneyFormatter } from '../components/money-format';
import { ReportFilters } from '../components/ReportFilters';
import { ReportShell } from '../components/ReportShell';
import { toSheet } from '../components/report-sheet';
import { ReportTable, type ReportColumn } from '../components/ReportTable';
import { useReportParams } from '../components/useReportParams';

type Row = VendorMargin & { name: string };

export function VendorMarginPage() {
  const { params, updateParams } = useReportParams(reportParamsSchema);
  const query = useQuery(vendorMarginQuery(params));
  const [{ data: hotels }, { data: currencies }] = useSuspenseQueries({
    queries: [hotelOptionsQuery, currenciesQuery],
  });
  const money = moneyFormatter(currencies, params.currency);

  const columns: ReportColumn<Row>[] = [
    { header: 'Vendor', cell: (row) => row.name, value: (row) => row.name },
    {
      header: 'Room-nights',
      isNumeric: true,
      cell: (row) => row.roomNights,
      value: (row) => asNumber(row.roomNights),
    },
    {
      header: 'Revenue',
      isNumeric: true,
      cell: (row) => money(row.revenue),
      value: (row) => asNumber(row.revenue),
    },
    {
      header: 'Cost at actual rate',
      isNumeric: true,
      cell: (row) => (row.cost === null ? 'No vendor' : money(row.cost)),
      value: (row) => (row.cost === null ? '' : asNumber(row.cost)),
    },
    {
      header: 'Margin',
      isNumeric: true,
      cell: (row) => (row.margin === null ? '—' : money(row.margin)),
      value: (row) => (row.margin === null ? '' : asNumber(row.margin)),
    },
  ];
  const rowsOf = (data: NonNullable<typeof query.data>): Row[] =>
    data.rows
      .map((row) => ({
        ...row,
        name:
          row.vendorId === null ? 'No vendor allocated' : (data.names.vendors[row.vendorId] ?? row.vendorId),
      }))
      .sort((a, b) => (a.vendorId === null ? 1 : b.vendorId === null ? -1 : a.name.localeCompare(b.name)));

  return (
    <ReportShell
      title="Vendor-wise margin"
      subtitle="Vendors compared at their actual rates, through each sale's vendor allocation. The main P&L uses the weighted average instead."
      query={query}
      fileName={`Vendor margin ${params.currency}.xlsx`}
      filters={
        <ReportFilters
          params={params}
          onChange={updateParams}
          hotels={hotels}
          currencies={currencies}
          periodLabel="Stay nights"
          showHotel={false}
        />
      }
      sheets={(data) => [toSheet('Vendors', columns, rowsOf(data))]}
    >
      {(data) => (
        <Card>
          <ReportTable
            caption="Vendor-wise margin"
            columns={columns}
            rows={rowsOf(data)}
            rowKey={(row) => row.vendorId ?? 'none'}
            empty="Nothing was sold for nights in this period."
          />
        </Card>
      )}
    </ReportShell>
  );
}
