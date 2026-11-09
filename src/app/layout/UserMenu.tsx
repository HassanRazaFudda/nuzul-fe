import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';

import { useSignOut } from '@/features/users';
import { useCurrentUser } from '@/lib/auth/session';
import { cn } from '@/lib/cn';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

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
      className={cn(
        'flex items-center gap-2.5 py-3',
        isRail ? 'border-border flex-col border-t px-2' : 'px-4',
      )}
    >
      {user && (
        <span
          aria-hidden
          className="bg-surface-muted text-secondary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
        >
          {initials(user.name)}
        </span>
      )}
      {!isRail && <p className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">{user?.name}</p>}
      <button
        type="button"
        onClick={handleSwitch}
        aria-label="Switch user"
        title="Switch user"
        className="rounded-control text-muted hover:bg-surface-muted hover:text-foreground p-1.5 transition-colors duration-150"
      >
        <LogOut aria-hidden className="size-[1.125rem]" />
      </button>
    </div>
  );
}
