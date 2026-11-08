import { Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { Suspense, useEffect, useRef, useState, ViewTransition } from 'react';
import { Outlet, useLocation } from 'react-router';

import { Toaster } from '@/components/feedback/Toaster';
import { Spinner } from '@/components/ui/Spinner';

import { SidebarNav } from './SidebarNav';
import { UserMenu } from './UserMenu';

const COLLAPSE_KEY = 'nuzul.sidebar.collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false; // storage blocked: fall back to the expanded sidebar
  }
}

function saveCollapsed(isCollapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, isCollapsed ? '1' : '0');
  } catch {
    // storage blocked: the preference simply lasts for this page view
  }
}

function Mark() {
  return (
    <div
      aria-hidden
      className="rounded-card bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center font-bold"
    >
      N
    </div>
  );
}

const ICON_BUTTON = 'rounded-control p-1.5 text-muted hover:bg-background hover:text-foreground';

export function AppLayout() {
  const { pathname } = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);

  // After a route change, focus moves to the page so keyboard and screen-reader users land
  // on the new content. The DOM's focus is the external system here. Not on first load.
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    mainRef.current?.focus();
  }, [pathname]);

  function toggleCollapsed() {
    saveCollapsed(!isCollapsed);
    setIsCollapsed(!isCollapsed);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
  }

  return (
    <div
      className="min-h-dvh lg:grid lg:transition-[grid-template-columns] lg:duration-200 print:block"
      style={{
        gridTemplateColumns: `${isCollapsed ? 'var(--sidebar-rail-width)' : 'var(--sidebar-width)'} minmax(0, 1fr)`,
      }}
    >
      <a
        href="#main"
        className="focus:rounded-control focus:bg-surface sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="border-border bg-surface sticky top-0 hidden h-dvh flex-col overflow-hidden border-e lg:flex print:hidden">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <Mark />
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className={ICON_BUTTON}
            >
              <PanelLeftOpen aria-hidden className="size-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-5 py-5">
            <Mark />
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-sm leading-tight font-bold">Nuzul</p>
              <p className="text-muted text-xs leading-tight">Hotel contracts</p>
            </div>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className={ICON_BUTTON}
            >
              <PanelLeftClose aria-hidden className="size-5" />
            </button>
          </div>
        )}
        <SidebarNav isRail={isCollapsed} />
        <UserMenu isRail={isCollapsed} />
      </aside>

      {/* Mobile top bar */}
      <div className="border-border bg-surface flex items-center gap-3 border-b px-4 py-3 lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => {
            setIsDrawerOpen(true);
          }}
          aria-label="Open menu"
          className="text-foreground"
        >
          <Menu aria-hidden className="size-6" />
        </button>
        <span className="text-primary font-bold">Nuzul</span>
      </div>

      {/* Mobile drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={closeDrawer}
            className="bg-scrim absolute inset-0 size-full"
          />
          <aside className="bg-surface shadow-overlay absolute inset-y-0 start-0 flex w-(--sidebar-width) max-w-[85vw] flex-col">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <Mark />
                <p className="text-foreground text-sm font-bold">Nuzul</p>
              </div>
              <button type="button" onClick={closeDrawer} aria-label="Close menu" className="text-muted">
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <SidebarNav isRail={false} onNavigate={closeDrawer} />
            <UserMenu isRail={false} />
          </aside>
        </div>
      )}

      <main id="main" ref={mainRef} tabIndex={-1} className="min-w-0">
        <ViewTransition key={pathname} default="none" enter="page-in" exit="page-out">
          <div>
            <Suspense fallback={<Spinner />}>
              <Outlet />
            </Suspense>
          </div>
        </ViewTransition>
      </main>
      <Toaster />
    </div>
  );
}
