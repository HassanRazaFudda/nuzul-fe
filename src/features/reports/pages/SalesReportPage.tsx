import { useQuery, useSuspenseQueries } from '@tanstack/react-query';

import { FormField } from '@/components/form/FormField';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { currenciesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';
import { formatIsoDate } from '@/lib/format/dates';

import { salesReportQuery } from '../api/report.queries';
import { salesParamsSchema } from '../api/report.schemas';
import { SALES_GROUPS, type SalesGroup, type SalesRow } from '../domain/reports';
import { amountFormatter, asNumber, moneyFormatter } from '../components/money-format';
import { ReportFilters } from '../components/ReportFilters';
import { ReportShell } from '../components/ReportShell';
import { toSheet } from '../components/report-sheet';
import { ReportTable, type ReportColumn } from '../components/ReportTable';
import { useReportParams } from '../components/useReportParams';

const GROUP_LABELS: Record<SalesGroup, string> = {
  date: 'Contract date',
  agent: 'Agent',
  hotel: 'Hotel',
  vendor: 'Vendor',
};

type Row = SalesRow & { label: string };

const isGroup = (value: string): value is SalesGroup => SALES_GROUPS.some((group) => group === value);

export function SalesReportPage() {
  const { params, updateParams } = useReportParams(salesParamsSchema);
  const query = useQuery(salesReportQuery(params));
  const [{ data: hotels }, { data: currencies }] = useSuspenseQueries({
    queries: [hotelOptionsQuery, currenciesQuery],
  });
  const money = moneyFormatter(currencies, params.currency);
  const amount = amountFormatter(currencies, params.currency);

  const labelOf = (data: NonNullable<typeof query.data>, group: string) => {
    if (params.groupBy === 'date') return group ? formatIsoDate(group) : '';
    const names =
      params.groupBy === 'agent'
        ? data.names.agents
        : params.groupBy === 'hotel'
          ? data.names.hotels
          : data.names.vendors;
    if (group === '') return 'No vendor allocated';
    return names[group] ?? group;
  };
  const columns: ReportColumn<Row>[] = [
    { header: GROUP_LABELS[params.groupBy], cell: (row) => row.label, value: (row) => row.label },
    { header: 'Contracts', isNumeric: true, cell: (row) => row.contracts, value: (row) => row.contracts },
    { header: 'Hotels', isNumeric: true, cell: (row) => row.hotels, value: (row) => row.hotels },
    { header: 'Rooms', isNumeric: true, cell: (row) => row.rooms, value: (row) => row.rooms },
    {
      header: 'Room-nights',
      isNumeric: true,
      cell: (row) => row.roomNights,
      value: (row) => asNumber(row.roomNights),
    },
    {
      header: 'Sales amount',
      isNumeric: true,
      cell: (row) => amount(row.amount),
      value: (row) => asNumber(row.amount),
    },
  ];
  const rowsOf = (data: NonNullable<typeof query.data>): Row[] =>
    data.rows.map((row) => ({ ...row, label: labelOf(data, row.group) }));
  const amountOf = (rows: Row[]) => rows.reduce((total, row) => total + asNumber(row.amount), 0);

  return (
    <ReportShell
      currency={params.currency}
      title="Sales"
      query={query}
      fileName={`Sales by ${params.groupBy} ${params.currency}.xlsx`}
      filters={
        <ReportFilters
          params={params}
          onChange={updateParams}
          hotels={hotels}
          currencies={currencies}
          periodLabel="Contract date"
        >
          <FormField label="Group by">
            {(field) => (
              <Select
                {...field}
                value={params.groupBy}
                onChange={(event) => {
                  if (isGroup(event.target.value)) updateParams({ groupBy: event.target.value });
                }}
              >
                {SALES_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {GROUP_LABELS[group]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Status">
            {(field) => (
              <Select
                {...field}
                value={params.status}
                onChange={(event) => {
                  const { value } = event.target;
                  if (value === 'confirmed' || value === 'draft' || value === 'cancelled')
                    updateParams({ status: value });
                }}
              >
                <option value="confirmed">Confirmed</option>
                <option value="draft">Draft</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            )}
          </FormField>
          <FormField label="City">
            {(field) => (
              <Select
                {...field}
                value={params.city}
                onChange={(event) => {
                  updateParams({ city: event.target.value });
                }}
              >
                <option value="">All cities</option>
                {(query.data?.cities ?? []).map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Meal plan">
            {(field) => (
              <Select
                {...field}
                value={params.mealPlan}
                onChange={(event) => {
                  const parsed = salesParamsSchema.shape.mealPlan.parse(event.target.value);
                  updateParams({ mealPlan: parsed });
                }}
              >
                <option value="">Any</option>
                <option value="none">None</option>
                <option value="perNightPerPerson">Per night per person</option>
                <option value="halfboard">Halfboard</option>
                <option value="fullboard">Fullboard</option>
              </Select>
            )}
          </FormField>
          <FormField label="Rate type">
            {(field) => (
              <Select
                {...field}
                value={params.rateType}
                onChange={(event) => {
                  const parsed = salesParamsSchema.shape.rateType.parse(event.target.value);
                  updateParams({ rateType: parsed });
                }}
              >
                <option value="">Any</option>
                <option value="occupancy">By occupancy</option>
                <option value="flat">Flat</option>
              </Select>
            )}
          </FormField>
        </ReportFilters>
      }
      sheets={(data) => [toSheet(`Sales by ${params.groupBy}`, columns, rowsOf(data))]}
    >
      {(data) => {
        const rows = rowsOf(data);
        return (
          <Card className="overflow-hidden">
            {rows.length > 0 && (
              <p className="text-muted border-border border-b px-5 py-3 text-sm">
                Total sales{' '}
                <span className="text-foreground ms-1 text-base font-medium tabular-nums">
                  {money(amountOf(rows).toFixed(2))}
                </span>
              </p>
            )}
            <ReportTable
              caption="Sales"
              columns={columns}
              rows={rows}
              rowKey={(row) => row.group || 'none'}
              empty="No contracts match these filters"
            />
          </Card>
        );
      }}
    </ReportShell>
  );
}
