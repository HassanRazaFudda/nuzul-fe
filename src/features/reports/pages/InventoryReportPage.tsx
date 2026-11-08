import { useQuery, useSuspenseQueries } from '@tanstack/react-query';

import { Card } from '@/components/ui/Card';
import { calendarMonthsQuery, formatDay } from '@/features/calendar';
import { currenciesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';

import { inventoryReportQuery } from '../api/report.queries';
import { reportParamsSchema } from '../api/report.schemas';
import type { InventoryRow } from '../domain/reports';
import { asNumber, moneyFormatter } from '../components/money-format';
import { ReportFilters } from '../components/ReportFilters';
import { ReportShell } from '../components/ReportShell';
import { toSheet } from '../components/report-sheet';
import { ReportTable, type ReportColumn } from '../components/ReportTable';
import { useReportParams } from '../components/useReportParams';

type Row = InventoryRow & { pool: string };

interface InventoryReportPageProps {
  /** Only purchased nights nobody bought, with their cost. */
  isExposureOnly?: boolean;
}

export function InventoryReportPage({ isExposureOnly = false }: InventoryReportPageProps) {
  const { params, updateParams } = useReportParams(reportParamsSchema);
  const query = useQuery(inventoryReportQuery(params));
  const [{ data: hotels }, { data: currencies }, { data: months }] = useSuspenseQueries({
    queries: [hotelOptionsQuery, currenciesQuery, calendarMonthsQuery],
  });
  const money = moneyFormatter(currencies, params.currency);
  const day = (iso: string) => formatDay(iso, months);
  const count = (
    field: 'purchased' | 'sold' | 'unsold' | 'overbooked',
    header: string,
  ): ReportColumn<Row> => ({
    header,
    isNumeric: true,
    cell: (row) => row[field],
    value: (row) => row[field],
  });

  const columns: ReportColumn<Row>[] = [
    { header: 'Hotel and room type', cell: (row) => row.pool, value: (row) => row.pool },
    {
      header: 'From night',
      cell: (row) => day(row.checkIn),
      value: (row) => `${day(row.checkIn)} (${row.checkIn})`,
    },
    {
      header: 'Until',
      cell: (row) => day(row.checkOut),
      value: (row) => `${day(row.checkOut)} (${row.checkOut})`,
    },
    count('purchased', 'Purchased'),
    count('sold', 'Sold'),
    count('unsold', 'Unsold'),
    ...(isExposureOnly ? [] : [count('overbooked', 'Overbooked')]),
    {
      header: 'Unsold cost',
      isNumeric: true,
      cell: (row) => money(row.exposure),
      value: (row) => asNumber(row.exposure),
    },
  ];
  const rowsOf = (data: NonNullable<typeof query.data>): Row[] =>
    data.rows
      .filter((row) => !isExposureOnly || row.unsold > 0)
      .map((row) => ({
        ...row,
        pool: `${data.names.hotels[row.hotelId] ?? row.hotelId}, ${data.names.roomTypes[row.roomTypeId] ?? row.roomTypeId}`,
      }));
  const exposureOf = (rows: Row[]) => rows.reduce((total, row) => total + asNumber(row.exposure), 0);

  return (
    <ReportShell
      title={isExposureOnly ? 'Unsold cost exposure' : 'Sold and unsold inventory'}
      subtitle={
        isExposureOnly
          ? 'Purchased nights nobody bought, at the weighted average cost. A memo, not part of the P&L.'
          : 'Room-nights per hotel, room type and night'
      }
      query={query}
      fileName={`${isExposureOnly ? 'Unsold exposure' : 'Inventory'} ${params.currency}.xlsx`}
      filters={
        <ReportFilters
          params={params}
          onChange={updateParams}
          hotels={hotels}
          currencies={currencies}
          periodLabel="Stay nights"
          showPolicy={false}
        />
      }
      sheets={(data) => [toSheet(isExposureOnly ? 'Exposure' : 'Inventory', columns, rowsOf(data))]}
    >
      {(data) => {
        const rows = rowsOf(data);
        return (
          <Card>
            {isExposureOnly && rows.length > 0 && (
              <p className="text-foreground border-border border-b px-5 py-3 text-sm">
                Total unsold cost:{' '}
                <span className="font-semibold tabular-nums">{money(exposureOf(rows).toFixed(2))}</span>
              </p>
            )}
            <ReportTable
              caption={isExposureOnly ? 'Unsold cost exposure' : 'Sold and unsold inventory'}
              columns={columns}
              rows={rows}
              rowKey={(row) => `${row.hotelId}/${row.roomTypeId}/${row.checkIn}`}
              empty={
                isExposureOnly
                  ? 'Every purchased night in this period is sold.'
                  : 'Nothing on the ledger in this period.'
              }
            />
          </Card>
        );
      }}
    </ReportShell>
  );
}

export function ExposureReportPage() {
  return <InventoryReportPage isExposureOnly />;
}
