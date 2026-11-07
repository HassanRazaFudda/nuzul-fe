import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { Download, Plus } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { toast } from '@/components/feedback/toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Stat } from '@/components/ui/Stat';
import { calendarMonthsQuery } from '@/features/calendar';
import { getErrorMessage } from '@/lib/api/api-error';

import { poolDetailQuery, useAddSampleSale, useRemoveSampleSale } from '../api/ledger.queries';
import { BuyList } from '../components/BuyList';
import { InventoryStateTag } from '../components/InventoryStateTag';
import { exportLedger } from '../components/ledger-export';
import { NightGrid } from '../components/NightGrid';
import { PoolSources } from '../components/PoolSources';
import { ResultTable } from '../components/ResultTable';
import { SampleSaleForm, type SampleSaleFormValues } from '../components/SampleSaleForm';
import { resultHidesShortage, roomNights } from '../domain/pools';

export function PoolPage() {
  const { hotelId = '', roomTypeId = '' } = useParams();
  const { data: detail } = useSuspenseQuery(poolDetailQuery(hotelId, roomTypeId));
  const [{ data: months }] = useSuspenseQueries({ queries: [calendarMonthsQuery] });
  const addSampleSale = useAddSampleSale();
  const removeSampleSale = useRemoveSampleSale();
  const [isAddingSale, setIsAddingSale] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  const { ledger, figures, pool, hotelName, roomTypeName } = detail;
  const poolName = `${hotelName}, ${roomTypeName}`;

  async function handleAddSale(values: SampleSaleFormValues) {
    await addSampleSale.mutateAsync({ ...values, hotelId, roomTypeId });
    setIsAddingSale(false);
    toast('Sample sale added');
  }

  function handleRemoveSale(id: string) {
    setActionError(null);
    removeSampleSale.mutate(id, {
      onSuccess: () => {
        toast('Sample sale removed');
      },
      onError: setActionError,
    });
  }

  async function handleExport() {
    if (!ledger) return;
    setActionError(null);
    setIsExporting(true);
    try {
      await exportLedger(ledger, months, `Ledger ${hotelName} ${roomTypeName}.xlsx`);
    } catch (error) {
      setActionError(error);
    }
    setIsExporting(false);
  }

  return (
    <>
      <PageHeader
        title={poolName}
        subtitle="Worked out from current records on every view"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {figures && <InventoryStateTag state={figures.state} rooms={Math.abs(figures.lowestAvailable)} />}
            <Button
              variant="secondary"
              icon={<Plus aria-hidden className="size-4" />}
              onClick={() => {
                setIsAddingSale(true);
              }}
            >
              Add sample sale
            </Button>
            {ledger && (
              <Button
                variant="secondary"
                icon={<Download aria-hidden className="size-4" />}
                isLoading={isExporting}
                onClick={() => void handleExport()}
              >
                Export to Excel
              </Button>
            )}
          </div>
        }
      />
      <div className="space-y-5 p-5 lg:p-8">
        {actionError !== null && (
          <ErrorNotice title="This could not be done">{getErrorMessage(actionError)}</ErrorNotice>
        )}

        {!ledger || !figures ? (
          <Card>
            <EmptyState
              title="Nothing on this pool"
              hint="Only confirmed purchases and sales count. Confirm a purchase of this room type at this hotel."
            />
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat
                label="Worst shortage"
                value={figures.shortage}
                {...(figures.shortage > 0 ? { tone: 'danger' as const } : {})}
                hint="Rooms short on the worst night"
              />
              <Stat label="Room-nights purchased" value={roomNights(ledger, 'purchased')} />
              <Stat label="Room-nights sold" value={roomNights(ledger, 'sold')} />
            </div>

            <Card>
              <CardHeader title="Night by night" subtitle="This decides whether a night is overbooked" />
              <NightGrid nights={ledger.nights} months={months} />
            </Card>

            {ledger.need.length > 0 && (
              <Card>
                <CardHeader title="Rooms to buy" subtitle="Buying these clears the shortage" />
                <BuyList hotelId={hotelId} roomTypeId={roomTypeId} need={ledger.need} months={months} />
              </Card>
            )}

            <Card>
              <CardHeader title="Result" subtitle="A summary by date range. The night grid above decides." />
              {resultHidesShortage(ledger) && (
                <div className="p-4">
                  <ErrorNotice title="This summary hides a shortage">
                    At least one night is short, but no row below shows it. Go by the night grid above.
                  </ErrorNotice>
                </div>
              )}
              <ResultTable rows={ledger.result} months={months} />
            </Card>
          </>
        )}

        <Card>
          <CardHeader title="What feeds this pool" />
          <PoolSources pool={pool} months={months} onRemoveSale={handleRemoveSale} />
        </Card>
      </div>

      {isAddingSale && (
        <SampleSaleForm
          poolName={poolName}
          onSave={handleAddSale}
          onClose={() => {
            setIsAddingSale(false);
          }}
        />
      )}
    </>
  );
}
