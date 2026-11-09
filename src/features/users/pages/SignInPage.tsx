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
      <Card className="w-full max-w-sm">
        <div className="space-y-5 p-6">
          <div>
            <img src="/brand/logo.png" alt="" className="mb-4 size-10 object-contain" />
            <h1 className="text-foreground text-xl font-semibold">Sign in to Nuzul</h1>
            <p className="text-muted mt-1 text-sm">A prototype with no passwords. Choose who to be</p>
          </div>
          {signIn.error && (
            <ErrorNotice title="Could not sign in">{getErrorMessage(signIn.error)}</ErrorNotice>
          )}
          <ul className="space-y-2">
            {users.map((user) => (
              <li key={user.id}>
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  icon={<LogIn aria-hidden className="text-muted size-4" />}
                  isLoading={signIn.isPending && signIn.variables === user.id}
                  onClick={() => {
                    signIn.mutate(user.id, {
                      onSuccess: () => void navigate('/'),
                    });
                  }}
                >
                  <span className="flex-1 text-start">{user.name}</span>
                  <span className="text-muted text-xs font-normal">
                    {user.permissions.length} permissions
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </main>
  );
}
