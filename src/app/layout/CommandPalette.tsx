import { useQueries, useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BedDouble,
  CornerDownLeft,
  FileSignature,
  Handshake,
  Layers,
  Plus,
  Search,
  ShoppingCart,
  Store,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { contractListQuery } from '@/features/contracts';
import { hotelOptionsQuery } from '@/features/hotels';
import { seasonPoolsQuery } from '@/features/inventory';
import { partnerOptionsQuery } from '@/features/partners';
import { purchaseListQuery } from '@/features/purchases';
import { useCan } from '@/lib/auth/session';
import { cn } from '@/lib/cn';

import { onCommandPaletteOpen } from './command-palette';
import { NAVIGATION, SETTINGS_ITEMS } from './navigation';

interface Command {
  id: string;
  group: string;
  label: string;
  detail?: string | undefined;
  /** Text matched against what is typed, beyond the label. */
  keywords?: string;
  icon: ReactNode;
  to: string;
  /** Right-aligned, such as a record's state. */
  meta?: string | undefined;
}

const ICON = 'size-4 shrink-0';
const PURCHASE_STATUSES = ['draft', 'confirmed', 'locked', 'cancelled', 'terminated'] as const;
const CONTRACT_STATUSES = ['draft', 'confirmed', 'locked', 'cancelled'] as const;
const ALL = { page: 1, pageSize: 500, search: '', hotelId: '' };
const STATUS_WORD: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  locked: 'Locked',
  cancelled: 'Cancelled',
  terminated: 'Terminated',
};
const GROUP_LIMIT = 6;

/** Every word typed must appear somewhere in the command, in any order. */
function matches(command: Command, words: string[]) {
  const haystack = `${command.label} ${command.detail ?? ''} ${command.keywords ?? ''}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/**
 * One box to reach anything: a record by number, a hotel's rooms, an agent's contracts, a page,
 * or a new purchase or contract. Opens with Ctrl K (⌘K on a Mac) or the sidebar's search.
 */
export function CommandPalette() {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const can = useCan();
  const listId = useId();

  // A keyboard shortcut and the open event are both outside React, so an effect listens.
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen((open) => !open);
      }
    }
    window.addEventListener('keydown', onKey);
    const stop = onCommandPaletteOpen(() => {
      setIsOpen(true);
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      stop();
    };
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
      inputRef.current?.focus();
    }
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const purchases = useQueries({
    queries: PURCHASE_STATUSES.map((status) => ({
      ...purchaseListQuery({ ...ALL, status, sortBy: 'number', sortDir: 'desc' }),
      enabled: isOpen && can('purchase.view'),
    })),
  });
  const contracts = useQueries({
    queries: CONTRACT_STATUSES.map((status) => ({
      ...contractListQuery({ ...ALL, status, sortBy: 'number', sortDir: 'desc' }),
      enabled: isOpen && can('contract.view'),
    })),
  });
  const pools = useQuery({ ...seasonPoolsQuery, enabled: isOpen && can('inventory.view') });
  const hotels = useQuery({ ...hotelOptionsQuery, enabled: isOpen });
  const agents = useQuery({ ...partnerOptionsQuery('agents'), enabled: isOpen });
  const vendors = useQuery({ ...partnerOptionsQuery('vendors'), enabled: isOpen });

  const pages: Command[] = [...NAVIGATION.flatMap((group) => group.items), ...SETTINGS_ITEMS]
    .filter((item) => !item.permissions || item.permissions.some(can))
    .map((item) => {
      const Icon = item.icon;
      return {
        id: `page:${item.path}`,
        group: 'Go to',
        label: item.label,
        icon: <Icon aria-hidden className={ICON} />,
        to: `/${item.path}`,
        keywords: 'page open go',
      };
    });

  const actions: Command[] = (
    [
      can('contract.create') && {
        id: 'new:contract',
        group: 'Create',
        label: 'New sales contract',
        keywords: 'add sell sale agent',
        icon: <Plus aria-hidden className={ICON} />,
        to: '/contracts/new',
      },
      can('purchase.create') && {
        id: 'new:purchase',
        group: 'Create',
        label: 'New purchase',
        keywords: 'add buy vendor',
        icon: <Plus aria-hidden className={ICON} />,
        to: '/purchases/new',
      },
    ] as (Command | false)[]
  ).filter((item): item is Command => Boolean(item));

  const records: Command[] = [
    ...contracts.flatMap((query) =>
      (query.data?.items ?? []).map((contract) => ({
        id: `contract:${contract.id}`,
        group: 'Sales contracts',
        label: contract.number,
        detail: `${contract.agentName} · ${[...new Set(contract.hotels.map((entry) => entry.hotelName))].join(', ')}`,
        icon: <FileSignature aria-hidden className={ICON} />,
        to: `/contracts/${contract.id}`,
        meta: STATUS_WORD[contract.status],
      })),
    ),
    ...purchases.flatMap((query) =>
      (query.data?.items ?? []).map((purchase) => ({
        id: `purchase:${purchase.id}`,
        group: 'Purchases',
        label: purchase.number,
        detail: `${purchase.hotelName} · ${purchase.vendorName}`,
        icon: <ShoppingCart aria-hidden className={ICON} />,
        to: `/purchases/${purchase.id}`,
        meta: STATUS_WORD[purchase.status],
      })),
    ),
    ...(pools.data?.pools ?? []).map((pool) => ({
      id: `pool:${pool.id}`,
      group: 'Rooms',
      label: `${pool.hotelName} · ${pool.roomTypeName}`,
      detail:
        pool.state === 'overbooked'
          ? `Overbooked by ${String(pool.shortage)}`
          : pool.state === 'full'
            ? 'Fully utilised'
            : `${String(pool.lowestAvailable)} available on the tightest night`,
      keywords: 'ledger pool rooms availability',
      icon: <Layers aria-hidden className={ICON} />,
      to: `/inventory/${pool.hotelId}/${pool.roomTypeId}`,
    })),
    ...(hotels.data ?? []).map((hotel) => ({
      id: `hotel:${hotel.id}`,
      group: 'Hotels',
      label: hotel.name,
      detail: 'Rooms in the ledger',
      keywords: 'hotel',
      icon: <BedDouble aria-hidden className={ICON} />,
      to: `/inventory?hotel=${hotel.id}`,
    })),
    ...(agents.data ?? []).map((agent) => ({
      id: `agent:${agent.id}`,
      group: 'Agents',
      label: agent.name,
      detail: 'Their sales contracts',
      keywords: 'agent customer',
      icon: <Handshake aria-hidden className={ICON} />,
      to: `/contracts?search=${encodeURIComponent(agent.name)}`,
    })),
    ...(vendors.data ?? []).map((vendor) => ({
      id: `vendor:${vendor.id}`,
      group: 'Vendors',
      label: vendor.name,
      detail: 'Their purchases',
      keywords: 'vendor supplier',
      icon: <Store aria-hidden className={ICON} />,
      to: `/purchases?search=${encodeURIComponent(vendor.name)}`,
    })),
  ];

  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const attention: Command[] = (pools.data?.pools ?? [])
    .filter((pool) => pool.state === 'overbooked')
    .map((pool) => ({
      id: `attention:${pool.id}`,
      group: 'Needs attention',
      label: `${pool.hotelName} · ${pool.roomTypeName}`,
      detail: `Overbooked by ${String(pool.shortage)} ${pool.shortage === 1 ? 'room' : 'rooms'}`,
      icon: <Layers aria-hidden className={cn(ICON, 'text-danger')} />,
      to: `/inventory/${pool.hotelId}/${pool.roomTypeId}`,
    }));

  const pool =
    words.length === 0
      ? [...actions, ...attention, ...pages]
      : [...actions, ...records, ...pages].filter((command) => matches(command, words));

  // Keep each group short so one search shows every kind of match.
  const counts = new Map<string, number>();
  const results = pool.filter((command) => {
    const seen = counts.get(command.group) ?? 0;
    counts.set(command.group, seen + 1);
    return words.length === 0 || seen < GROUP_LIMIT;
  });
  const safeActive = Math.min(active, Math.max(results.length - 1, 0));

  function close() {
    setIsOpen(false);
    setText('');
    setActive(0);
  }

  function run(command: Command | undefined) {
    if (!command) return;
    close();
    void navigate(command.to);
  }

  function moveTo(index: number) {
    setActive(index);
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${String(index)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveTo(results.length === 0 ? 0 : (safeActive + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveTo(results.length === 0 ? 0 : (safeActive - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(results[safeActive]);
    }
  }

  const isLoading =
    isOpen &&
    words.length > 0 &&
    (purchases.some((query) => query.isPending && query.fetchStatus === 'fetching') ||
      contracts.some((query) => query.isPending && query.fetchStatus === 'fetching'));

  let lastGroup = '';

  return (
    <dialog
      ref={ref}
      aria-label="Search and go"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={() => {
        if (isOpen) close();
      }}
      // A click on the backdrop closes it, like Esc.
      {...{ closedby: 'any' }}
      className="border-border bg-surface text-foreground shadow-overlay animate-overlay-in mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-xl border p-0"
    >
      <div className="border-border flex items-center gap-2.5 border-b px-4">
        <Search aria-hidden className="text-muted size-4 shrink-0" />
        <input
          ref={inputRef}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setActive(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search records, hotels, agents, or type a command"
          aria-label="Search"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[safeActive] ? `${listId}-${String(safeActive)}` : undefined}
          aria-autocomplete="list"
          className="placeholder:text-faint h-13 w-full bg-transparent text-[0.9375rem] outline-none focus-visible:outline-none"
        />
        <kbd className="border-border text-muted text-2xs rounded border px-1.5 py-0.5">Esc</kbd>
      </div>

      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="Results"
        className="max-h-[22rem] overflow-y-auto p-1.5"
      >
        {results.length === 0 && (
          <p className="text-muted px-3 py-8 text-center text-sm">
            {isLoading ? 'Searching…' : `Nothing matches “${text.trim()}”`}
          </p>
        )}
        {isLoading && results.length > 0 && (
          <p className="text-muted px-2.5 pt-1.5 pb-1 text-xs">Loading purchases and contracts…</p>
        )}
        {results.map((command, index) => {
          const showGroup = command.group !== lastGroup;
          lastGroup = command.group;
          const isActive = index === safeActive;
          return (
            <div key={command.id}>
              {showGroup && (
                <p className="text-muted text-2xs px-2.5 pt-2.5 pb-1 font-medium">{command.group}</p>
              )}
              <div
                id={`${listId}-${String(index)}`}
                data-index={index}
                role="option"
                aria-selected={isActive}
                tabIndex={-1}
                onMouseMove={() => {
                  if (!isActive) setActive(index);
                }}
                onClick={() => {
                  run(command);
                }}
                onKeyDown={() => undefined}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm',
                  isActive ? 'bg-surface-muted' : '',
                )}
              >
                <span className={cn('text-muted', isActive && 'text-foreground')}>{command.icon}</span>
                <span className="min-w-0 flex-1 truncate">
                  <span
                    className={cn(
                      'text-foreground',
                      /^(PUR|CON)-\d+$/.test(command.label) && 'text-meta font-mono font-medium',
                    )}
                  >
                    {command.label}
                  </span>
                  {command.detail && <span className="text-muted text-meta ms-2">{command.detail}</span>}
                </span>
                {command.meta && <span className="text-muted shrink-0 text-xs">{command.meta}</span>}
                {isActive && <CornerDownLeft aria-hidden className="text-muted size-3.5 shrink-0" />}
              </div>
            </div>
          );
        })}
      </div>

      <footer className="border-border bg-surface-raised text-muted flex items-center gap-4 border-t px-4 py-2 text-xs">
        <span className="flex items-center gap-1.5">
          <kbd className="border-border bg-surface rounded border px-1">↑</kbd>
          <kbd className="border-border bg-surface rounded border px-1">↓</kbd>
          to move
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="border-border bg-surface rounded border px-1">Enter</kbd>
          to open
        </span>
        <span className="ms-auto flex items-center gap-1">
          Type PUR-, CON-, a hotel or an agent
          <ArrowRight aria-hidden className="size-3" />
        </span>
      </footer>
    </dialog>
  );
}
