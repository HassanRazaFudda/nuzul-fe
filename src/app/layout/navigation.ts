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
  Palette,
  Scale,
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
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/** The menu follows the work: buy, sell, watch the ledger, then the setup behind it. */
export const NAVIGATION: NavGroup[] = [
  { items: [{ path: '', label: 'Overview', icon: LayoutDashboard }] },
  {
    label: 'Operations',
    items: [
      {
        path: 'purchases',
        label: 'Purchases',
        icon: ShoppingCart,
        permissions: ['purchase.view'],
      },
      {
        path: 'contracts',
        label: 'Sales contracts',
        icon: FileSignature,
        permissions: ['contract.view'],
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
      { path: 'hotels', label: 'Hotels', icon: BedDouble },
      { path: 'vendors', label: 'Vendors', icon: Store },
      { path: 'agents', label: 'Agents', icon: Handshake },
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
  {
    label: 'System',
    items: [
      { path: 'room-types', label: 'Room types', icon: DoorOpen },
      { path: 'calendar', label: 'Calendar', icon: CalendarDays },
      { path: 'currencies', label: 'Currencies', icon: Coins },
      {
        path: 'users',
        label: 'Users & permissions',
        icon: UserCog,
        permissions: ['user.manage', 'permission.assign'],
      },
      {
        path: 'audit',
        label: 'Audit log',
        icon: History,
        permissions: ['audit.view'],
      },
      { path: 'design', label: 'Design system', icon: Palette },
    ],
  },
];

export const PLACEHOLDER_ITEMS = NAVIGATION.flatMap((group) => group.items).filter(
  (item): item is NavItem & { purpose: string } => item.purpose !== undefined,
);
