import { useSuspenseQuery } from '@tanstack/react-query';
import { LogIn } from 'lucide-react';
import { useNavigate } from 'react-router';

import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getErrorMessage } from '@/lib/api/api-error';

import { signInChoicesQuery, useSignIn } from '../api/user.queries';

/** The prototype's sign-in: choose who you are. The backend adds passwords. */
export function SignInPage() {
  const { data: users } = useSuspenseQuery(signInChoicesQuery);
  const signIn = useSignIn();
  const navigate = useNavigate();

  return (
    <main className="bg-background flex min-h-dvh items-center justify-center p-5">
      <title>Sign in · Nuzul</title>
      <Card className="w-full max-w-md">
        <div className="space-y-4 p-6">
          <div>
            <h1 className="text-foreground text-lg font-bold">Sign in as</h1>
            <p className="text-muted text-sm">
              A prototype: there is no password yet, and nothing here is secure. Choose a user to see the
              system with their permissions.
            </p>
          </div>
          {signIn.error && (
            <ErrorNotice title="Could not sign in">{getErrorMessage(signIn.error)}</ErrorNotice>
          )}
          <ul className="space-y-2">
            {users.map((user) => (
              <li key={user.id}>
                <Button
                  variant="secondary"
                  className="w-full justify-between"
                  icon={<LogIn aria-hidden className="size-4" />}
                  isLoading={signIn.isPending && signIn.variables === user.id}
                  onClick={() => {
                    signIn.mutate(user.id, {
                      onSuccess: () => void navigate('/'),
                    });
                  }}
                >
                  {user.name}
                  <span className="text-muted text-xs">{user.permissions.length} permissions</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </main>
  );
}
