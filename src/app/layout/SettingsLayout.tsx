import { NavLink, Outlet } from 'react-router';

import { useCan } from '@/lib/auth/session';
import { cn } from '@/lib/cn';

import { SETTINGS_ITEMS } from './navigation';

/**
 * One frame for everything set up once a season: a short menu beside the page, so moving from
 * the calendar to the currencies does not go back through the main menu.
 */
export function SettingsLayout() {
  const can = useCan();
  const items = SETTINGS_ITEMS.filter((item) => !item.permissions || item.permissions.some(can));

  return (
    <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)]">
      <aside className="px-(--page-gutter) pt-5 lg:sticky lg:top-0 lg:h-dvh lg:pe-0 lg:pt-7">
        <p className="text-foreground mb-2 hidden px-2.5 text-xs font-medium lg:block">Settings</p>
        <nav
          aria-label="Settings"
          className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:mx-0 lg:flex-col lg:gap-px"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={`/${item.path}`}
                className={({ isActive }) =>
                  cn(
                    'rounded-control flex h-8 shrink-0 items-center gap-2.5 px-2.5 text-sm whitespace-nowrap transition-colors duration-150',
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
                      className={cn('size-4 shrink-0', isActive ? 'text-accent' : 'text-muted')}
                    />
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
