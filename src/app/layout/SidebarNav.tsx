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
      className={cn('flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-3', isRail ? 'px-2' : 'px-3')}
    >
      {groups.map((group) => (
        <div key={group.label ?? 'top'} className="flex flex-col gap-1">
          {group.label &&
            (isRail ? (
              <div className="border-border mx-2 my-2 border-t" />
            ) : (
              <p className="text-muted px-3 pt-4 pb-1 text-xs font-semibold tracking-wider uppercase">
                {group.label}
              </p>
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
                    'rounded-control flex items-center text-sm font-medium transition-colors duration-150',
                    isRail ? 'justify-center py-2.5' : 'gap-3 px-3 py-2',
                    isActive
                      ? 'bg-primary-subtle text-primary-strong'
                      : 'text-muted hover:bg-background hover:text-foreground',
                  )
                }
              >
                <Icon aria-hidden className="size-5 shrink-0" />
                {!isRail && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
