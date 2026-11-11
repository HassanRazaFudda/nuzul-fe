import { useQuery } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import { NavLink, useLocation } from 'react-router';

import { overbookedPoolsQuery } from '@/features/inventory';
import { useCan } from '@/lib/auth/session';
import { cn } from '@/lib/cn';

import { NAVIGATION, SETTINGS_ITEMS, type NavItem } from './navigation';

interface SidebarNavProps {
  isRail: boolean;
  onNavigate?: () => void;
}

const ROW =
  'group rounded-control flex h-8 items-center text-sm transition-colors duration-150 outline-offset-0';

function NavRow({
  item,
  isRail,
  isActiveOverride,
  count,
  onNavigate,
}: {
  item: Pick<NavItem, 'path' | 'label' | 'icon'>;
  isRail: boolean;
  isActiveOverride?: boolean;
  count?: number | undefined;
  onNavigate?: (() => void) | undefined;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={`/${item.path}`}
      end={item.path === ''}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      title={isRail ? item.label : undefined}
      aria-label={isRail ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          ROW,
          isRail ? 'relative justify-center' : 'gap-2.5 px-2.5',
          (isActiveOverride ?? isActive)
            ? 'bg-surface text-foreground shadow-raised ring-border font-medium ring-1'
            : 'text-secondary hover:bg-surface-muted hover:text-foreground',
        )
      }
      {...(isActiveOverride ? { 'aria-current': 'page' as const } : {})}
    >
      {({ isActive }) => {
        const on = isActiveOverride ?? isActive;
        return (
          <>
            <Icon
              aria-hidden
              className={cn('size-4 shrink-0', on ? 'text-accent' : 'text-muted group-hover:text-secondary')}
            />
            {!isRail && <span className="flex-1 truncate">{item.label}</span>}
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  'bg-danger text-danger-foreground rounded-pill text-2xs text-center leading-4 font-semibold tabular-nums',
                  isRail ? 'absolute -top-0.5 -right-0.5 size-4' : 'min-w-4.5 px-1',
                )}
                title={`${String(count)} overbooked`}
              >
                {count}
                <span className="sr-only"> overbooked</span>
              </span>
            )}
          </>
        );
      }}
    </NavLink>
  );
}

export function SidebarNav({ isRail, onNavigate }: SidebarNavProps) {
  const can = useCan();
  const { pathname } = useLocation();
  const overbooked = useQuery({ ...overbookedPoolsQuery, enabled: can('inventory.view') }).data;
  const allowed = (item: NavItem) => !item.permissions || item.permissions.some(can);
  // Areas the signed-in user cannot open are left out of the menu.
  const groups = NAVIGATION.map((group) => ({ ...group, items: group.items.filter(allowed) })).filter(
    (group) => group.items.length > 0,
  );
  const settings = SETTINGS_ITEMS.filter(allowed);
  const firstSetting = settings[0];
  const isInSettings = settings.some(
    (item) => pathname === `/${item.path}` || pathname.startsWith(`/${item.path}/`),
  );

  return (
    <nav
      aria-label="Main"
      className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto pb-3', isRail ? 'px-2' : 'px-3')}
    >
      {groups.map((group) => (
        <div key={group.label ?? 'top'} className="flex flex-col gap-px">
          {group.label &&
            (isRail ? (
              <div className="border-border mx-2 my-2.5 border-t" />
            ) : (
              <p className="text-muted px-2.5 pt-5 pb-1 text-xs font-medium">{group.label}</p>
            ))}
          {group.items.map((item) => (
            <NavRow
              key={item.path}
              item={item}
              isRail={isRail}
              onNavigate={onNavigate}
              count={item.path === 'inventory' ? overbooked : undefined}
            />
          ))}
        </div>
      ))}
      {firstSetting && (
        <div className="mt-auto flex flex-col gap-px pt-4">
          <NavRow
            item={{ path: firstSetting.path, label: 'Settings', icon: Settings }}
            isRail={isRail}
            isActiveOverride={isInSettings}
            onNavigate={onNavigate}
          />
        </div>
      )}
    </nav>
  );
}
