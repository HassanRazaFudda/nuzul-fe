import { createColumnHelper } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { DataTable, type DataTableSort } from '@/components/data-table/DataTable';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { TableSkeleton } from '@/components/feedback/TableSkeleton';
import { FormField } from '@/components/form/FormField';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Stat, SummaryStrip } from '@/components/ui/Stat';
import { TabBar } from '@/components/ui/TabBar';
import {
  computeLedger,
  InventoryStateTag,
  nightState,
  UnknownCost,
  type LedgerNightRow,
} from '@/features/inventory';
import { formatMoney } from '@/lib/money/money';

const SAR = { symbol: 'SAR', decimals: 2 };

/** The first worked example from the SRS, through the real engine. */
const SAMPLE_NIGHTS =
  computeLedger({
    purchases: [{ from: 25, to: 34, rooms: 125 }],
    sales: [
      { from: 25, to: 34, rooms: 20 },
      { from: 25, to: 31, rooms: 16 },
      { from: 31, to: 34, rooms: 121 },
    ],
  })?.nights ?? [];

const columnHelper = createColumnHelper<ServerTableFeatures, LedgerNightRow>();

const numeric = (header: string) => ({
  header: () => <span className="block text-end">{header}</span>,
  cell: ({ getValue }: { getValue: () => number }) => (
    <span className="block text-end tabular-nums">{getValue()}</span>
  ),
});

const COLUMNS = columnHelper.columns([
  columnHelper.accessor('from', {
    header: 'Nights',
    cell: (info) => `${info.row.original.from} to ${info.row.original.to}`,
  }),
  columnHelper.accessor('purchased', numeric('Purchased')),
  columnHelper.accessor('sold', numeric('Sold')),
  columnHelper.accessor('available', numeric('Available')),
  columnHelper.display({
    id: 'state',
    header: 'State',
    cell: (info) => (
      <InventoryStateTag
        state={nightState(info.row.original.available)}
        rooms={Math.abs(info.row.original.available)}
      />
    ),
  }),
]);

const SWATCHES = [
  ['primary (ink)', 'bg-primary'],
  ['accent (Junaidi red)', 'bg-accent'],
  ['secondary', 'bg-secondary'],
  ['muted', 'bg-muted'],
  ['border', 'bg-border'],
  ['surface-muted', 'bg-surface-muted'],
  ['background', 'bg-background'],
  ['success', 'bg-success'],
  ['warning', 'bg-warning'],
] as const;

type StateView = 'data' | 'empty' | 'loading' | 'error';

function sortedNights(sort: DataTableSort | undefined): LedgerNightRow[] {
  if (!sort) return SAMPLE_NIGHTS;
  const key = sort.id as 'from' | 'purchased' | 'sold' | 'available';
  return [...SAMPLE_NIGHTS].sort((a, b) => (sort.desc ? b[key] - a[key] : a[key] - b[key]));
}

export function DesignSystemPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [stateView, setStateView] = useState<StateView>('data');
  const [sort, setSort] = useState<DataTableSort | undefined>(undefined);

  return (
    <>
      <PageHeader
        title="Design system"
        action={<Button icon={<Plus aria-hidden className="size-4" />}>Primary action</Button>}
      />
      <div className="space-y-5 p-5 lg:p-8">
        <Card>
          <CardHeader
            title="Colour tokens"
            subtitle="Ink acts, red asks for a look, green and amber carry state"
          />
          <div className="grid grid-cols-3 gap-4 p-5 sm:grid-cols-5 lg:grid-cols-9">
            {SWATCHES.map(([name, className]) => (
              <div key={name}>
                <div className={`rounded-control border-border h-12 border ${className}`} />
                <p className="text-muted mt-1 text-xs">{name}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Buttons" />
          <div className="flex flex-wrap items-center gap-2 p-5">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger-ghost">Danger ghost</Button>
            <Button variant="ghost">Ghost</Button>
            <Button
              variant="danger"
              onClick={() => {
                setIsDialogOpen(true);
              }}
            >
              Danger, opens a dialog
            </Button>
            <Button isLoading>Saving</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Form fields" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <FormField label="Hotel" required hint="Required on every purchase">
                {(field) => <Input {...field} placeholder="Artal International" />}
              </FormField>
              <FormField label="Room type">
                {(field) => (
                  <Select {...field} defaultValue="double">
                    <option value="double">Double</option>
                    <option value="triple">Triple</option>
                    <option value="quad">Quad</option>
                  </Select>
                )}
              </FormField>
              <FormField label="Rooms" error="Enter at least 1 room" className="sm:col-span-2">
                {(field) => <Input {...field} type="number" defaultValue="0" />}
              </FormField>
            </div>
          </Card>

          <Card>
            <CardHeader title="Inventory states" subtitle="Words first, never colour alone" />
            <div className="flex flex-wrap items-center gap-2 p-5">
              <InventoryStateTag state="available" rooms={89} />
              <InventoryStateTag state="full" />
              <InventoryStateTag state="overbooked" rooms={16} />
              <span className="text-muted flex items-center gap-1.5 text-sm">
                Cost: <UnknownCost />
              </span>
            </div>
            <SummaryStrip className="mx-5 mb-5">
              <Stat label="Profit, known portion" value={formatMoney('500', SAR)} hint="Partial" />
              <Stat label="Unknown cost" value="2 rooms" tone="danger" hint="Revenue SAR 300.00" />
            </SummaryStrip>
          </Card>
        </div>

        <Card>
          <CardHeader title="Data table" subtitle="SRS Case 1 through the real ledger engine" />
          <div className="space-y-4 p-5">
            <TabBar
              label="Table states"
              value={stateView}
              onChange={setStateView}
              items={[
                { value: 'data', label: 'Data', count: SAMPLE_NIGHTS.length },
                { value: 'empty', label: 'Empty' },
                { value: 'loading', label: 'Loading' },
                { value: 'error', label: 'Error' },
              ]}
            />
            <Card>
              {stateView === 'data' && (
                <DataTable
                  caption="Example ledger"
                  columns={COLUMNS}
                  data={sortedNights(sort)}
                  getRowId={(row) => `${row.from}-${row.to}`}
                  sort={sort}
                  onSortChange={setSort}
                  emptyState={null}
                />
              )}
              {stateView === 'empty' && (
                <EmptyState title="No drafts" hint="Drafts appear here and never affect the ledger." />
              )}
              {stateView === 'loading' && <TableSkeleton rows={3} columns={4} />}
              {stateView === 'error' && (
                <div className="p-4">
                  <ErrorNotice title="This could not be saved" action={<Button size="sm">Try again</Button>}>
                    Check the highlighted fields and try again.
                  </ErrorNotice>
                </div>
              )}
            </Card>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={isDialogOpen}
        onCancel={() => {
          setIsDialogOpen(false);
        }}
        onConfirm={() => {
          setIsDialogOpen(false);
        }}
        title="Cancel this purchase?"
        confirmLabel="Cancel purchase"
        tone="danger"
      >
        12 rooms already sold on these nights would lose their cover and show as overbooked.
      </ConfirmDialog>
    </>
  );
}
