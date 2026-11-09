import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Stat, SummaryStrip } from '@/components/ui/Stat';
import { calendarMonthsQuery } from '@/features/calendar';
import { getErrorMessage } from '@/lib/api/api-error';

import { poolDetailQuery } from '../api/ledger.queries';
import { BuyList } from '../components/BuyList';
import { InventoryStateTag } from '../components/InventoryStateTag';
import { exportLedger } from '../components/ledger-export';
import { NightGrid } from '../components/NightGrid';
import { PoolSources } from '../components/PoolSources';
import { ResultTable } from '../components/ResultTable';
import { resultHidesShortage, roomNights } from '../domain/pools';

export function PoolPage() {
  const { hotelId = '', roomTypeId = '' } = useParams();
  const { data: detail } = useSuspenseQuery(poolDetailQuery(hotelId, roomTypeId));
  const [{ data: months }] = useSuspenseQueries({ queries: [calendarMonthsQuery] });
  const [isExporting, setIsExporting] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  const { ledger, figures, pool, hotelName, roomTypeName } = detail;
  const poolName = `${hotelName}, ${roomTypeName}`;

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
        status={
          figures && <InventoryStateTag state={figures.state} rooms={Math.abs(figures.lowestAvailable)} />
        }
        action={
          <>
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
          </>
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
              hint="Confirm a purchase of this room type at this hotel to start it"
            />
          </Card>
        ) : (
          <>
            <SummaryStrip>
              <Stat
                label="Worst shortage"
                value={figures.shortage}
                {...(figures.shortage > 0 ? { tone: 'danger' as const } : {})}
                hint="Rooms short on the worst night"
              />
              <Stat label="Room-nights purchased" value={roomNights(ledger, 'purchased')} />
              <Stat label="Room-nights sold" value={roomNights(ledger, 'sold')} />
            </SummaryStrip>

            <Card className="overflow-hidden">
              <CardHeader title="Night by night" />
              <NightGrid nights={ledger.nights} months={months} />
            </Card>

            {ledger.need.length > 0 && (
              <Card>
                <CardHeader title="Rooms to buy" />
                <BuyList hotelId={hotelId} roomTypeId={roomTypeId} need={ledger.need} months={months} />
              </Card>
            )}

            <Card className="overflow-hidden">
              <CardHeader title="Result by date range" />
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
          <CardHeader title="What feeds this pool" subtitle="Confirmed records only" />
          <PoolSources pool={pool} months={months} />
        </Card>
      </div>
    </>
  );
}
