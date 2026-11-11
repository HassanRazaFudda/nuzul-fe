import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { ChevronDown, Download } from 'lucide-react';
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
        breadcrumbs={[{ label: 'Rooms ledger', to: '/inventory' }]}
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
      <div className="space-y-5 px-(--page-gutter) pt-4 pb-10">
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
            {ledger.need.length > 0 && (
              <Card className="border-danger-border overflow-hidden">
                <CardHeader
                  title="Rooms to buy"
                  subtitle={`Overbooked by up to ${String(figures.shortage)} ${figures.shortage === 1 ? 'room' : 'rooms'}. Each purchase below clears part of it.`}
                  divided
                />
                <BuyList hotelId={hotelId} roomTypeId={roomTypeId} need={ledger.need} months={months} />
              </Card>
            )}

            <SummaryStrip>
              {figures.shortage > 0 ? (
                <Stat
                  label="Short on the worst night"
                  value={figures.shortage}
                  tone="danger"
                  hint="Rooms sold without a purchase"
                />
              ) : (
                <Stat
                  label="Free on the tightest night"
                  value={figures.lowestAvailable}
                  hint={
                    figures.lowestAvailable === 0
                      ? 'Sold out on at least one night'
                      : 'Can still be sold on every night'
                  }
                />
              )}
              <Stat
                label="Room-nights purchased"
                value={roomNights(ledger, 'purchased').toLocaleString('en-GB')}
              />
              <Stat label="Room-nights sold" value={roomNights(ledger, 'sold').toLocaleString('en-GB')} />
              <Stat
                label="Left to sell"
                value={Math.max(
                  roomNights(ledger, 'purchased') - roomNights(ledger, 'sold'),
                  0,
                ).toLocaleString('en-GB')}
                hint="Room-nights"
              />
            </SummaryStrip>

            <Card className="overflow-hidden">
              <CardHeader title="Night by night" divided />
              <NightGrid nights={ledger.nights} months={months} />
            </Card>

            <Card className="overflow-hidden">
              <details className="group">
                <summary className="hover:bg-surface-raised flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 transition-colors duration-150 [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="text-foreground block text-sm font-semibold">Result by date range</span>
                    <span className="text-muted text-meta block">
                      The ledger summarised by stay period, as on the printed sheet
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden
                    className="text-muted size-4 shrink-0 transition-transform duration-150 group-open:rotate-180"
                  />
                </summary>
                <div className="border-border border-t">
                  {resultHidesShortage(ledger) && (
                    <div className="p-4">
                      <ErrorNotice title="This summary hides a shortage">
                        At least one night is short, but no row below shows it. Go by the night grid above.
                      </ErrorNotice>
                    </div>
                  )}
                  <ResultTable rows={ledger.result} months={months} />
                </div>
              </details>
            </Card>
          </>
        )}

        <Card>
          <CardHeader title="What feeds this pool" subtitle="Confirmed purchases and sales" divided />
          <PoolSources pool={pool} months={months} />
        </Card>
      </div>
    </>
  );
}
