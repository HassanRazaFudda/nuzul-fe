import { useQuery } from '@tanstack/react-query';

import { QueryErrorState } from '@/components/feedback/QueryErrorState';
import { Card, CardHeader } from '@/components/ui/Card';
import { userNamesQuery } from '@/lib/auth/session';
import { formatMoney } from '@/lib/money/money';

import { revisionsQuery } from '../api/revision.queries';
import { ACTION_LABELS } from '../api/revision-labels';
import type { RevisionEntity } from '../api/revision.schemas';

const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

interface HistoryCardProps {
  entity: RevisionEntity;
  entityId: string;
  /** For records with a total, so the change in total can be shown. */
  money?: { symbol: string; decimals: number };
}

/** Every saved version of a record, newest first, with the reason given. */
export function HistoryCard({ entity, entityId, money }: HistoryCardProps) {
  const { data, error, refetch } = useQuery(revisionsQuery(entity, entityId));
  const { data: names } = useQuery(userNamesQuery);
  const who = (userId: string | null) =>
    userId === null ? 'Before sign-in' : (names?.[userId] ?? 'Unknown user');

  return (
    <Card>
      <CardHeader title="History" />
      {error ? (
        <div className="p-4">
          <QueryErrorState error={error} onRetry={() => void refetch()} />
        </div>
      ) : (
        <ol className="divide-border divide-y text-sm">
          {(data ?? []).map((revision) => (
            <li key={revision.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
              <span className="text-foreground">
                <span className="font-medium">{ACTION_LABELS[revision.action]}</span>
                <span className="text-muted">
                  {revision.version > 0 && ` · version ${String(revision.version)}`} · {who(revision.userId)}
                </span>
                {revision.reason && <span className="text-muted block text-xs">{revision.reason}</span>}
              </span>
              <span className="text-muted text-end text-xs tabular-nums">
                {dateTime.format(new Date(revision.at))}
                {money &&
                  revision.totalBefore !== null &&
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
          {data?.length === 0 && <li className="text-muted px-4 py-3">No changes recorded yet.</li>}
        </ol>
      )}
    </Card>
  );
}
