import { Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { Suspense, useEffect, useRef, useState, ViewTransition } from 'react';
import { Outlet, useLocation } from 'react-router';

import { Toaster } from '@/components/feedback/Toaster';
import { Spinner } from '@/components/ui/Spinner';

import { SampleDataNote } from './SampleDataNote';
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

/** Junaidi's mark beside the product's name. */
function Brand({ showName = true }: { showName?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/brand/logo.png" alt="" className="size-8 shrink-0 object-contain" />
      {showName && <span className="text-foreground text-base font-semibold">Nuzul</span>}
    </span>
  );
}

const ICON_BUTTON =
  'rounded-control p-1.5 text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-foreground';

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
      className="min-h-dvh lg:grid lg:transition-[grid-template-columns] lg:duration-200 print:block print:min-h-0"
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
            <Brand showName={false} />
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className={ICON_BUTTON}
            >
              <PanelLeftOpen aria-hidden className="size-[1.125rem]" />
            </button>
          </div>
        ) : (
          <div className="flex h-16 items-center justify-between gap-3 ps-5 pe-3">
            <Brand />
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className={ICON_BUTTON}
            >
              <PanelLeftClose aria-hidden className="size-[1.125rem]" />
            </button>
          </div>
        )}
        <SidebarNav isRail={isCollapsed} />
        {!isCollapsed && <SampleDataNote />}
        <UserMenu isRail={isCollapsed} />
      </aside>

      {/* Mobile top bar */}
      <div className="border-border bg-surface flex h-14 items-center gap-3 border-b px-4 lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => {
            setIsDrawerOpen(true);
          }}
          aria-label="Open menu"
          className="text-foreground"
        >
          <Menu aria-hidden className="size-5" />
        </button>
        <Brand />
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
            <div className="flex h-14 items-center justify-between ps-5 pe-3">
              <Brand />
              <button type="button" onClick={closeDrawer} aria-label="Close menu" className={ICON_BUTTON}>
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <SidebarNav isRail={false} onNavigate={closeDrawer} />
            <SampleDataNote />
            <UserMenu isRail={false} />
          </aside>
        </div>
      )}

      <main id="main" ref={mainRef} tabIndex={-1} className="min-w-0">
        <ViewTransition key={pathname} default="none" enter="page-in" exit="page-out">
          <div className="mx-auto max-w-[100rem] pb-12">
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
