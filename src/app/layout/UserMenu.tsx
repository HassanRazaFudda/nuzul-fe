import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';

import { useSignOut } from '@/features/users';
import { useCurrentUser } from '@/lib/auth/session';
import { cn } from '@/lib/cn';

/** Who is signed in, and a way to become someone else. A prototype: there is no password. */
export function UserMenu({ isRail }: { isRail: boolean }) {
  const user = useCurrentUser();
  const signOut = useSignOut();
  const navigate = useNavigate();

  function handleSwitch() {
    signOut.mutate(undefined, { onSuccess: () => void navigate('/sign-in') });
  }

  return (
    <div
      className={cn('border-border flex items-center gap-2 border-t py-3', isRail ? 'flex-col px-2' : 'px-4')}
    >
      {!isRail && (
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-medium">{user?.name}</p>
          <p className="text-muted text-xs">Signed in</p>
        </div>
      )}
      <button
        type="button"
        onClick={handleSwitch}
        aria-label="Switch user"
        title="Switch user"
        className="rounded-control text-muted hover:bg-background hover:text-foreground p-1.5"
      >
        <LogOut aria-hidden className="size-5" />
      </button>
    </div>
  );
}
