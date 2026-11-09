import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';

import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { toast } from '@/components/feedback/toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { HistoryCard } from '@/features/changes';
import { getErrorMessage } from '@/lib/api/api-error';
import { PERMISSION_TEMPLATES } from '@/lib/auth/permissions';
import { useCan, useCurrentUser } from '@/lib/auth/session';

import { userQuery, useSetPermissions, useSetUserActive } from '../api/user.queries';
import { PermissionGrid } from '../components/PermissionGrid';

export function UserPage() {
  const { id = '' } = useParams();
  const { data: user } = useSuspenseQuery(userQuery(id));
  const me = useCurrentUser();
  const can = useCan();
  const setPermissions = useSetPermissions();
  const setActive = useSetUserActive();
  // Edited here, saved together, so a template can be applied and then adjusted.
  const [draft, setDraft] = useState<string[] | null>(null);
  const selected = draft ?? user.permissions;
  const isChanged = draft !== null && [...draft].sort().join() !== [...user.permissions].sort().join();
  const canAssign = can('permission.assign');
  const error = setPermissions.error ?? setActive.error;

  function applyTemplate(name: string) {
    const template = PERMISSION_TEMPLATES.find((item) => item.name === name);
    if (!template) return;
    // Only what the signed-in user can give; the rest stays as it is.
    const mine = me?.permissions ?? [];
    setDraft([
      ...selected.filter((permission) => !mine.includes(permission)),
      ...template.permissions.filter((permission) => mine.includes(permission)),
    ]);
  }

  return (
    <>
      <PageHeader
        title={user.name}
        subtitle={`${String(user.permissions.length)} permissions${user.id === me?.id ? ' · you' : ''}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {user.active ? <Badge tone="success">Active</Badge> : <Badge>Deactivated</Badge>}
            {can('user.manage') && (
              <Button
                variant="secondary"
                isLoading={setActive.isPending}
                onClick={() => {
                  setActive.mutate(
                    { id, active: !user.active },
                    { onSuccess: () => toast(`${user.name} ${user.active ? 'deactivated' : 'activated'}`) },
                  );
                }}
              >
                {user.active ? 'Deactivate' : 'Activate'}
              </Button>
            )}
          </div>
        }
      />
      <div className="space-y-5 p-5 lg:p-8">
        {error && <ErrorNotice title="This could not be saved">{getErrorMessage(error)}</ErrorNotice>}
        <Card>
          <CardHeader
            title="Permissions"
            subtitle="A template fills in the ticks once; nothing stays linked"
            action={
              canAssign && (
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    aria-label="Apply a template"
                    className="w-48"
                    value=""
                    onChange={(event) => {
                      applyTemplate(event.target.value);
                    }}
                  >
                    <option value="">Apply a template…</option>
                    {PERMISSION_TEMPLATES.map((template) => (
                      <option key={template.name} value={template.name}>
                        {template.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    disabled={!isChanged}
                    isLoading={setPermissions.isPending}
                    onClick={() => {
                      setPermissions.mutate(
                        { id, permissions: selected },
                        {
                          onSuccess: () => {
                            setDraft(null);
                            toast(`Permissions saved for ${user.name}`);
                          },
                        },
                      );
                    }}
                  >
                    Save permissions
                  </Button>
                </div>
              )
            }
          />
          <PermissionGrid
            selected={selected}
            grantable={me?.permissions ?? []}
            disabled={!canAssign}
            onChange={setDraft}
          />
        </Card>
        <HistoryCard entity="user" entityId={id} />
      </div>
    </>
  );
}
