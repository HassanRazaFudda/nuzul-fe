import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';

import { QueryErrorState } from '@/components/feedback/QueryErrorState';
import { TableSkeleton } from '@/components/feedback/TableSkeleton';
import { FormField } from '@/components/form/FormField';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  ACTION_LABELS,
  ENTITY_LABELS,
  REVISION_ACTIONS,
  REVISION_ENTITIES,
  type Revision,
  type RevisionEntity,
} from '@/features/changes';
import { userNamesQuery } from '@/lib/auth/session';

import { auditQuery } from '../api/audit.queries';

const isoOrEmpty = z.union([z.literal(''), z.iso.date()]).catch('');
const filtersSchema = z.object({
  userId: z.string().max(100).catch(''),
  entity: z.union([z.literal(''), z.enum(REVISION_ENTITIES)]).catch(''),
  action: z.union([z.literal(''), z.enum(REVISION_ACTIONS)]).catch(''),
  from: isoOrEmpty,
  to: isoOrEmpty,
});
type Filters = z.infer<typeof filtersSchema>;

const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

const LINKS: Partial<Record<RevisionEntity, string>> = {
  purchase: '/purchases',
  contract: '/contracts',
  user: '/users',
};

const MAX_VALUE_LENGTH = 80;
const show = (value: unknown) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
};

/** The fields that differ between the record before and after, for a quick read. */
function changedFields(entry: Revision): [string, string, string][] {
  const { before, after } = entry;
  if (typeof before !== 'object' || before === null || typeof after !== 'object' || after === null) return [];
  const was = before as Record<string, unknown>;
  const now = after as Record<string, unknown>;
  return [...new Set([...Object.keys(was), ...Object.keys(now)])]
    .filter((key) => key !== 'version' && JSON.stringify(was[key]) !== JSON.stringify(now[key]))
    .map((key) => [key, show(was[key] ?? '—'), show(now[key] ?? '—')]);
}

/** Who did what and when. Append-only: nothing here can change an entry. */
export function AuditLogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = filtersSchema.parse(Object.fromEntries(searchParams));
  const query = useQuery(auditQuery(filters));
  const { data: names = {} } = useQuery(userNamesQuery);
  const who = (userId: string | null) =>
    userId === null ? 'Before sign-in' : (names[userId] ?? 'Unknown user');

  function update(patch: Partial<Filters>) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  }

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every change, who made it and why, newest first" />
      <div className="space-y-4 p-5 lg:p-8">
        <fieldset className="rounded-card border-border bg-surface grid gap-3 border p-4 sm:grid-cols-2 lg:grid-cols-5">
          <legend className="text-muted px-1 text-xs font-semibold">Filters</legend>
          <FormField label="User">
            {(field) => (
              <Select
                {...field}
                value={filters.userId}
                onChange={(event) => {
                  update({ userId: event.target.value });
                }}
              >
                <option value="">Everyone</option>
                {Object.entries(names).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Record">
            {(field) => (
              <Select
                {...field}
                value={filters.entity}
                onChange={(event) => {
                  update({ entity: filtersSchema.shape.entity.parse(event.target.value) });
                }}
              >
                <option value="">All records</option>
                {REVISION_ENTITIES.map((entity) => (
                  <option key={entity} value={entity}>
                    {ENTITY_LABELS[entity]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Action">
            {(field) => (
              <Select
                {...field}
                value={filters.action}
                onChange={(event) => {
                  update({ action: filtersSchema.shape.action.parse(event.target.value) });
                }}
              >
                <option value="">All actions</option>
                {REVISION_ACTIONS.map((action) => (
                  <option key={action} value={action}>
                    {ACTION_LABELS[action]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="From">
            {(field) => (
              <Input
                {...field}
                type="date"
                value={filters.from}
                onChange={(event) => {
                  update({ from: event.target.value });
                }}
              />
            )}
          </FormField>
          <FormField label="Until (not included)">
            {(field) => (
              <Input
                {...field}
                type="date"
                value={filters.to}
                onChange={(event) => {
                  update({ to: event.target.value });
                }}
              />
            )}
          </FormField>
        </fieldset>

        <Card>
          {query.isPending ? (
            <TableSkeleton rows={6} columns={4} />
          ) : !query.data ? (
            <div className="p-4">
              <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
            </div>
          ) : query.data.length === 0 ? (
            <p className="text-muted px-5 py-8 text-center text-sm">Nothing matches these filters.</p>
          ) : (
            <ol className="divide-border divide-y" aria-label="Audit entries">
              {query.data.map((entry) => {
                const base = LINKS[entry.entity];
                const changes = changedFields(entry);
                return (
                  <li key={entry.id} className="space-y-1 px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-foreground">
                        <span className="font-medium">{who(entry.userId)}</span> ·{' '}
                        {ACTION_LABELS[entry.action]} · {ENTITY_LABELS[entry.entity]}{' '}
                        {base ? (
                          <Link to={`${base}/${entry.entityId}`} className="text-primary-strong underline">
                            {entry.entityId}
                          </Link>
                        ) : (
                          <span className="text-muted">{entry.entityId}</span>
                        )}
                      </span>
                      <span className="text-muted text-xs tabular-nums">
                        {dateTime.format(new Date(entry.at))}
                      </span>
                    </div>
                    {entry.reason && <p className="text-muted text-xs">{entry.reason}</p>}
                    {changes.length > 0 && (
                      <details className="text-xs">
                        <summary className="text-primary-strong cursor-pointer">
                          {changes.length} {changes.length === 1 ? 'field' : 'fields'} changed
                        </summary>
                        <ul className="text-muted mt-1 space-y-0.5">
                          {changes.map(([field, was, now]) => (
                            <li key={field}>
                              <span className="text-foreground">{field}</span>: {was} → {now}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
