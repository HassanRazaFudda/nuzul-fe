import {
  BedDouble,
  BookOpenCheck,
  CalendarDays,
  ChartColumn,
  Coins,
  DoorOpen,
  FileSignature,
  Handshake,
  History,
  LayoutDashboard,
  Scale,
  ScrollText,
  ShoppingCart,
  Store,
  UserCog,
  type LucideIcon,
} from 'lucide-react';

import type { Permission } from '@/lib/auth/permissions';

export interface NavItem {
  /** Path under the root; empty for the overview. */
  path: string;
  label: string;
  icon: LucideIcon;
  /** What the module will do, shown until it is built. */
  purpose?: string;
  /** Shown when the signed-in user holds any of these. Every one, when there are none. */
  permissions?: readonly Permission[];
  /** A short line under the label in the Settings menu. */
  description?: string;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/**
 * The menu holds the daily work only: sell, buy, watch the rooms, then the people and the
 * money. Everything set up once a season lives in Settings.
 */
export const NAVIGATION: NavGroup[] = [
  { items: [{ path: '', label: 'Overview', icon: LayoutDashboard }] },
  {
    label: 'Work',
    items: [
      {
        path: 'contracts',
        label: 'Sales contracts',
        icon: FileSignature,
        permissions: ['contract.view'],
      },
      {
        path: 'purchases',
        label: 'Purchases',
        icon: ShoppingCart,
        permissions: ['purchase.view'],
      },
      {
        path: 'inventory',
        label: 'Rooms ledger',
        icon: BookOpenCheck,
        permissions: ['inventory.view'],
      },
    ],
  },
  {
    label: 'Directory',
    items: [
      { path: 'agents', label: 'Agents', icon: Handshake },
      { path: 'hotels', label: 'Hotels', icon: BedDouble },
      { path: 'vendors', label: 'Vendors', icon: Store },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        path: 'profit-loss',
        label: 'Profit & loss',
        icon: Scale,
        permissions: ['finance.view_cost'],
      },
      {
        path: 'reports',
        label: 'Reports',
        icon: ChartColumn,
        permissions: ['report.view'],
      },
    ],
  },
];

/** Configured once a season or by an administrator, so it sits behind one Settings entry. */
export const SETTINGS_ITEMS: NavItem[] = [
  {
    path: 'room-types',
    label: 'Room types',
    icon: DoorOpen,
    description: 'Types and which may be sold as another',
  },
  { path: 'calendar', label: 'Hijri calendar', icon: CalendarDays, description: 'Announced month dates' },
  { path: 'currencies', label: 'Currencies', icon: Coins, description: 'Exchange rates against PKR' },
  {
    path: 'settings/agreement',
    label: 'Agreement',
    icon: ScrollText,
    permissions: ['settings.manage'],
    description: 'Company details and printed terms',
  },
  {
    path: 'users',
    label: 'Users & permissions',
    icon: UserCog,
    permissions: ['user.manage', 'permission.assign'],
    description: 'Who can do what',
  },
  {
    path: 'audit',
    label: 'Audit log',
    icon: History,
    permissions: ['audit.view'],
    description: 'Every change, by whom and when',
  },
];

export const PLACEHOLDER_ITEMS = NAVIGATION.flatMap((group) => group.items).filter(
  (item): item is NavItem & { purpose: string } => item.purpose !== undefined,
);
