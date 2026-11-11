import { useSuspenseQuery } from '@tanstack/react-query';
import { ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { toast } from '@/components/feedback/toast';
import { FormField } from '@/components/form/FormField';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/api/api-error';
import { useCan } from '@/lib/auth/session';

import { useCreateUser, usersQuery } from '../api/user.queries';

const MAX_NAME_LENGTH = 80;

export function UsersPage() {
  const { data: users } = useSuspenseQuery(usersQuery);
  const can = useCan();
  const createUser = useCreateUser();
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();

  function handleAdd() {
    const trimmed = name.trim();
    if (trimmed === '' || trimmed.length > MAX_NAME_LENGTH) {
      setNameError(trimmed === '' ? 'Enter the name' : `Keep it under ${String(MAX_NAME_LENGTH)} characters`);
      return;
    }
    createUser.mutate(trimmed, {
      onSuccess: (user) => {
        toast(`${user.name} added. Now give them permissions.`);
        setIsAdding(false);
        void navigate(`/users/${user.id}`);
      },
    });
  }

  return (
    <>
      <PageHeader
        title="Users & permissions"
        action={
          can('user.manage') && (
            <Button
              icon={<Plus aria-hidden className="size-4" />}
              onClick={() => {
                setName('');
                setNameError(undefined);
                setIsAdding(true);
              }}
            >
              Add user
            </Button>
          )
        }
      />
      <div className="px-(--page-gutter) pt-4 pb-10">
        <Card className="overflow-hidden">
          <ul className="divide-border-subtle divide-y">
            {users.map((user) => (
              <li key={user.id}>
                <Link
                  to={`/users/${user.id}`}
                  className="hover:bg-surface-raised flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm transition-colors duration-150"
                >
                  <span className="flex min-w-48 flex-1 items-center gap-3">
                    <span
                      aria-hidden
                      className="bg-surface-muted text-secondary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                    >
                      {user.name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((word) => word[0]?.toUpperCase() ?? '')
                        .join('')}
                    </span>
                    <span className="text-foreground font-medium">{user.name}</span>
                  </span>
                  <span className="text-muted text-meta w-32 tabular-nums">
                    {user.permissions.length} permissions
                  </span>
                  <span className="w-28">
                    {user.active ? <Badge tone="success">Active</Badge> : <Badge>Deactivated</Badge>}
                  </span>
                  <ChevronRight aria-hidden className="text-faint size-4" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Dialog
        open={isAdding}
        title="Add user"
        onClose={() => {
          setIsAdding(false);
        }}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsAdding(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" form="add-user" isLoading={createUser.isPending}>
              Add
            </Button>
          </>
        }
      >
        <form
          id="add-user"
          noValidate
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            handleAdd();
          }}
        >
          {createUser.error && (
            <ErrorNotice title="This could not be saved">{getErrorMessage(createUser.error)}</ErrorNotice>
          )}
          <FormField label="Name" required error={nameError}>
            {(field) => (
              <Input
                {...field}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
            )}
          </FormField>
        </form>
      </Dialog>
    </>
  );
}
