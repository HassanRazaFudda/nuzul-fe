/**
 * The permission catalogue from docs/security-and-permissions.md. Permissions are given to
 * each user directly; a template only fills in a list, which stays visible and editable.
 */

export const PERMISSION_GROUPS = [
  {
    area: 'Purchases',
    permissions: [
      ['purchase.view', 'See purchases'],
      ['purchase.create', 'Add purchases'],
      ['purchase.edit', 'Edit and restore purchases'],
      ['purchase.delete', 'Delete drafts and cancel purchases'],
      ['purchase.confirm', 'Confirm purchases'],
      ['purchase.terminate', 'Terminate purchases'],
      ['purchase.unlock', 'Lock and unlock purchases'],
    ],
  },
  {
    area: 'Contracts',
    permissions: [
      ['contract.view', 'See contracts'],
      ['contract.create', 'Add contracts'],
      ['contract.edit', 'Edit and restore contracts'],
      ['contract.delete', 'Delete drafts and cancel contracts'],
      ['contract.confirm', 'Confirm contracts'],
      ['contract.unlock', 'Lock and unlock contracts'],
    ],
  },
  {
    area: 'Inventory',
    permissions: [
      ['inventory.view', 'See the rooms ledger'],
      ['inventory.override_overbooking', 'Go ahead with a change that overbooks'],
    ],
  },
  {
    area: 'Reports',
    permissions: [
      ['report.view', 'See reports'],
      ['report.export', 'Export reports'],
      ['finance.view_cost', 'See costs, margins and profit'],
    ],
  },
  {
    area: 'Finance',
    permissions: [
      ['finance.set_rate', 'Change the exchange rate on a record'],
      ['currency.manage_rates', 'Manage currencies and rates'],
      ['period.close', 'Close a period'],
    ],
  },
  {
    area: 'Setup',
    permissions: [
      ['directory.manage', 'Manage hotels, vendors and agents'],
      ['calendar.manage', 'Manage the calendar'],
      ['conversion.manage', 'Manage room types and conversion'],
      ['settings.manage', 'Manage settings'],
    ],
  },
  {
    area: 'Administration',
    permissions: [
      ['user.manage', 'Add and deactivate users'],
      ['permission.assign', "Change users' permissions"],
      ['audit.view', 'See the audit log'],
    ],
  },
] as const;

export type Permission = (typeof PERMISSION_GROUPS)[number]['permissions'][number][0];

const ENTRIES: readonly (readonly [Permission, string])[] = PERMISSION_GROUPS.flatMap(
  (group): readonly (readonly [Permission, string])[] => group.permissions,
);

export const ALL_PERMISSIONS: readonly Permission[] = ENTRIES.map(([permission]) => permission);

export const isPermission = (value: string): value is Permission =>
  ALL_PERMISSIONS.some((permission) => permission === value);

export const PERMISSION_LABELS = Object.fromEntries(ENTRIES) as Record<Permission, string>;

const VIEW_PERMISSIONS: readonly Permission[] = [
  'purchase.view',
  'contract.view',
  'inventory.view',
  'report.view',
];

/** Starting points only: applying one fills the ticks, and nothing stays linked to it. */
export const PERMISSION_TEMPLATES: readonly { name: string; permissions: readonly Permission[] }[] = [
  { name: 'Admin', permissions: ALL_PERMISSIONS },
  {
    name: 'Purchasing',
    permissions: [
      'purchase.view',
      'purchase.create',
      'purchase.edit',
      'purchase.delete',
      'purchase.confirm',
      'purchase.terminate',
      'inventory.view',
      'directory.manage',
      'finance.view_cost',
    ],
  },
  {
    name: 'Sales',
    permissions: [
      'contract.view',
      'contract.create',
      'contract.edit',
      'contract.delete',
      'contract.confirm',
      'inventory.view',
      'inventory.override_overbooking',
    ],
  },
  {
    name: 'Accounts',
    permissions: [
      'report.view',
      'report.export',
      'finance.view_cost',
      'finance.set_rate',
      'currency.manage_rates',
      'purchase.view',
      'contract.view',
      'inventory.view',
    ],
  },
  { name: 'Viewer', permissions: VIEW_PERMISSIONS },
];

/** A user can give only what they hold, and take away only what they could give. */
export function grantProblems(
  granter: readonly string[],
  before: readonly string[],
  after: readonly string[],
): Permission[] {
  const changed = ALL_PERMISSIONS.filter(
    (permission) => before.includes(permission) !== after.includes(permission),
  );
  return changed.filter((permission) => !granter.includes(permission));
}
