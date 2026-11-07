import { useQueryClient, useSuspenseQueries } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Stat } from '@/components/ui/Stat';
import { calendarMonthsQuery } from '@/features/calendar';
import { hotelOptionsQuery } from '@/features/hotels';
import { overbookedPoolsQuery } from '@/features/inventory';
import { partnerOptionsQuery } from '@/features/partners';
import { mockDb } from '@/mock-api/db';

export function OverviewPage() {
  const queryClient = useQueryClient();
  const [{ data: hotels }, { data: vendors }, { data: agents }, { data: months }, { data: overbooked }] =
    useSuspenseQueries({
      queries: [
        hotelOptionsQuery,
        partnerOptionsQuery('vendors'),
        partnerOptionsQuery('agents'),
        calendarMonthsQuery,
        overbookedPoolsQuery,
      ],
    });
  const [isConfirming, setIsConfirming] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  async function handleReset() {
    setIsResetting(true);
    await mockDb.resetToSeed();
    await queryClient.invalidateQueries();
    setIsResetting(false);
    setIsConfirming(false);
  }

  return (
    <>
      <PageHeader title="Overview" subtitle="Hotel contracts, purchasing and the rooms ledger" />
      <div className="space-y-5 p-5 lg:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat
            label="Overbooked pools"
            value={
              <Link to="/inventory?status=overbooked" className="underline">
                {overbooked}
              </Link>
            }
            hint="Hotel and room types short on a night"
            {...(overbooked > 0 ? { tone: 'danger' as const } : {})}
          />
          <Stat label="Active hotels" value={hotels.length} />
          <Stat label="Active vendors" value={vendors.length} />
          <Stat label="Active agents" value={agents.length} />
          <Stat label="Calendar months" value={months.length} />
        </div>

        <Card>
          <CardHeader
            title="This is a prototype"
            subtitle="Sample data, kept in this browser only. There is no server and no login yet."
            action={
              <Button
                variant="secondary"
                size="sm"
                icon={<RotateCcw aria-hidden className="size-4" />}
                onClick={() => {
                  setIsConfirming(true);
                }}
              >
                Reset sample data
              </Button>
            }
          />
          <p className="text-muted px-5 py-4 text-sm">
            The screens are being finalised before the backend is built. Do not enter real bookings here:
            nothing is backed up, and nothing is shared with anyone else.
          </p>
        </Card>
      </div>

      <ConfirmDialog
        open={isConfirming}
        onCancel={() => {
          setIsConfirming(false);
        }}
        onConfirm={() => void handleReset()}
        title="Reset sample data?"
        confirmLabel="Reset"
        tone="danger"
        isBusy={isResetting}
      >
        Everything entered in this browser is replaced with the original sample data. This cannot be undone.
      </ConfirmDialog>
    </>
  );
}
