import {
  FileSignature,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  ShoppingCart,
  X,
} from 'lucide-react';
import { Suspense, useEffect, useRef, useState, ViewTransition } from 'react';
import { Outlet, useLocation } from 'react-router';

import { Toaster } from '@/components/feedback/Toaster';
import { Menu as ActionMenu } from '@/components/ui/Menu';
import { Spinner } from '@/components/ui/Spinner';
import { useCan } from '@/lib/auth/session';
import { cn } from '@/lib/cn';

import { openCommandPalette, shortcutLabel } from './command-palette';
import { CommandPalette } from './CommandPalette';

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

/** Search and create, at the top of the menu, so both are one click from every screen. */
function QuickActions({ isRail, onNavigate }: { isRail: boolean; onNavigate?: () => void }) {
  const can = useCan();
  const [shortcut] = useState(shortcutLabel);
  const newItems = [
    can('contract.create') && {
      label: 'Sales contract',
      to: '/contracts/new',
      icon: <FileSignature aria-hidden />,
      hint: 'Sell rooms to an agent',
    },
    can('purchase.create') && {
      label: 'Purchase',
      to: '/purchases/new',
      icon: <ShoppingCart aria-hidden />,
      hint: 'Buy rooms from a vendor',
    },
  ];
  const hasNew = newItems.some(Boolean);

  function search() {
    onNavigate?.();
    openCommandPalette();
  }

  if (isRail) {
    return (
      <div className="flex flex-col items-center gap-1 px-2 pb-2">
        <button
          type="button"
          onClick={search}
          aria-label="Search"
          title={`Search (${shortcut})`}
          className={ICON_BUTTON}
        >
          <Search aria-hidden className="size-4" />
        </button>
        {hasNew && (
          <ActionMenu label="Create new" items={newItems} align="start" triggerIcon={<Plus aria-hidden />} />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-3 pb-2">
      <button
        type="button"
        onClick={search}
        className="rounded-control border-border bg-surface text-muted shadow-control hover:border-border-strong hover:text-secondary text-meta flex h-8 min-w-0 flex-1 items-center gap-2 border px-2.5 transition-colors duration-150"
      >
        <Search aria-hidden className="size-3.5 shrink-0" />
        <span className="flex-1 truncate text-start">Search</span>
        <kbd className="text-muted text-2xs">{shortcut}</kbd>
      </button>
      {hasNew && (
        <ActionMenu
          label="Create new"
          items={newItems}
          align="start"
          triggerIcon={<Plus aria-hidden />}
          className="bg-primary text-primary-foreground shadow-solid-danger hover:bg-primary-hover hover:text-primary-foreground aria-expanded:bg-primary-active aria-expanded:text-primary-foreground"
        />
      )}
    </div>
  );
}

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
      <aside className="border-border bg-background sticky top-0 hidden h-dvh flex-col overflow-hidden border-e lg:flex print:hidden">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 pt-4 pb-3">
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
          <div className="flex h-14 items-center justify-between gap-3 ps-4 pe-2.5">
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
        <QuickActions isRail={isCollapsed} />
        <SidebarNav isRail={isCollapsed} />
        <UserMenu isRail={isCollapsed} />
      </aside>

      {/* Mobile top bar */}
      <div className="border-border bg-surface/90 sticky top-0 z-30 flex h-13 items-center gap-3 border-b px-4 backdrop-blur lg:hidden print:hidden">
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
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Search"
          className={cn(ICON_BUTTON, 'ms-auto')}
        >
          <Search aria-hidden className="size-5" />
        </button>
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
          <aside className="bg-background shadow-overlay absolute inset-y-0 start-0 flex w-(--sidebar-width) max-w-[85vw] flex-col">
            <div className="flex h-14 items-center justify-between ps-5 pe-3">
              <Brand />
              <button type="button" onClick={closeDrawer} aria-label="Close menu" className={ICON_BUTTON}>
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <QuickActions isRail={false} onNavigate={closeDrawer} />
            <SidebarNav isRail={false} onNavigate={closeDrawer} />
            <UserMenu isRail={false} />
          </aside>
        </div>
      )}

      <main id="main" ref={mainRef} tabIndex={-1} className="min-w-0">
        <ViewTransition key={pathname} default="none" enter="page-in" exit="page-out">
          <div className="mx-auto max-w-(--page-max)">
            <Suspense fallback={<Spinner />}>
              <Outlet />
            </Suspense>
          </div>
        </ViewTransition>
      </main>
      <Toaster />
      <CommandPalette />
    </div>
  );
}
