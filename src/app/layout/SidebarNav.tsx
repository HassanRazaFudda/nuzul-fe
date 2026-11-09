import { NavLink } from 'react-router';

import { useCan } from '@/lib/auth/session';
import { cn } from '@/lib/cn';

import { NAVIGATION } from './navigation';

interface SidebarNavProps {
  isRail: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ isRail, onNavigate }: SidebarNavProps) {
  const can = useCan();
  // Areas the signed-in user cannot open are left out of the menu.
  const groups = NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permissions || item.permissions.some(can)),
  })).filter((group) => group.items.length > 0);

  return (
    <nav
      aria-label="Main"
      className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto pb-4', isRail ? 'px-2' : 'px-3')}
    >
      {groups.map((group) => (
        <div key={group.label ?? 'top'} className="flex flex-col gap-0.5">
          {group.label &&
            (isRail ? (
              <div className="border-border mx-2 my-3 border-t" />
            ) : (
              <p className="text-muted px-3 pt-5 pb-1.5 text-xs font-medium">{group.label}</p>
            ))}
          {group.items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={`/${item.path}`}
                end={item.path === ''}
                {...(onNavigate ? { onClick: onNavigate } : {})}
                title={isRail ? item.label : undefined}
                aria-label={isRail ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'group rounded-control flex h-8 items-center text-sm transition-colors duration-150',
                    isRail ? 'justify-center' : 'gap-2.5 px-3',
                    isActive
                      ? 'bg-surface-muted text-foreground font-medium'
                      : 'text-secondary hover:bg-surface-muted hover:text-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      aria-hidden
                      className={cn(
                        'size-[1.125rem] shrink-0',
                        isActive ? 'text-accent' : 'text-muted group-hover:text-secondary',
                      )}
                    />
                    {!isRail && <span className="truncate">{item.label}</span>}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
