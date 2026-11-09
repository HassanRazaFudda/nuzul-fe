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
      <div className="p-5 lg:p-8">
        <Card className="overflow-hidden">
          <ul className="divide-border divide-y">
            {users.map((user) => (
              <li key={user.id}>
                <Link
                  to={`/users/${user.id}`}
                  className="hover:bg-background flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm transition-colors duration-150"
                >
                  <span className="text-foreground min-w-48 flex-1 font-medium">{user.name}</span>
                  <span className="text-muted w-32 text-[0.8125rem] tabular-nums">
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
