import { useQuery } from '@tanstack/react-query';

import { QueryErrorState } from '@/components/feedback/QueryErrorState';
import { Card, CardHeader } from '@/components/ui/Card';
import { formatMoney } from '@/lib/money/money';

import { revisionsQuery } from '../api/revision.queries';
import type { RevisionAction, RevisionEntity } from '../api/revision.schemas';

const ACTION_LABELS: Record<RevisionAction, string> = {
  created: 'Created',
  edited: 'Edited',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  terminated: 'Terminated',
  'vendor-released': 'Vendor rooms released',
  'line-cancelled': 'Line cancelled',
  're-sourced': 'Re-sourced',
  'overbooking-accepted': 'Overbooking accepted',
};

const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

interface HistoryCardProps {
  entity: RevisionEntity;
  entityId: string;
  money: { symbol: string; decimals: number };
}

/** Every saved version of a record, newest first, with the reason given. */
export function HistoryCard({ entity, entityId, money }: HistoryCardProps) {
  const { data, error, refetch } = useQuery(revisionsQuery(entity, entityId));

  return (
    <Card>
      <CardHeader title="History" subtitle="Every version, newest first" />
      {error ? (
        <div className="p-4">
          <QueryErrorState error={error} onRetry={() => void refetch()} />
        </div>
      ) : (
        <ol className="divide-border divide-y text-sm">
          {(data ?? []).map((revision) => (
            <li key={revision.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
              <span className="text-foreground">
                <span className="font-medium">{ACTION_LABELS[revision.action]}</span>
                <span className="text-muted"> · version {revision.version}</span>
                {revision.reason && <span className="text-muted block text-xs">{revision.reason}</span>}
              </span>
              <span className="text-muted text-end text-xs tabular-nums">
                {dateTime.format(new Date(revision.at))}
                {revision.totalBefore !== null &&
                  revision.totalAfter !== null &&
                  revision.totalBefore !== revision.totalAfter && (
                    <span className="block">
                      Total {formatMoney(revision.totalBefore, money)} →{' '}
                      {formatMoney(revision.totalAfter, money)}
                    </span>
                  )}
              </span>
            </li>
          ))}
          {data?.length === 0 && <li className="text-muted px-5 py-3">No changes recorded yet.</li>}
        </ol>
      )}
    </Card>
  );
}
