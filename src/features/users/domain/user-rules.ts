/** The rules for changing users, kept pure so the server applies the very same ones. */

import { grantProblems, PERMISSION_LABELS, type Permission } from '@/lib/auth/permissions';

export interface UserLike {
  id: string;
  active: boolean;
  permissions: readonly string[];
}

/** Why a change to a user is refused, or null when it may go ahead. */
export function changeProblem(
  actor: UserLike,
  users: readonly UserLike[],
  before: UserLike,
  after: UserLike,
): string | null {
  const permissionsChanged =
    before.permissions.length !== after.permissions.length ||
    before.permissions.some((permission) => !after.permissions.includes(permission));
  if (permissionsChanged && !actor.permissions.includes('permission.assign')) {
    return 'You need the permission to change permissions.';
  }
  if (before.active !== after.active && !actor.permissions.includes('user.manage')) {
    return 'You need the permission to add and deactivate users.';
  }
  const beyond = grantProblems(actor.permissions, before.permissions, after.permissions);
  if (beyond.length > 0) {
    return `You can only give or take away what you hold yourself: ${beyond
      .map((permission: Permission) => PERMISSION_LABELS[permission])
      .join(', ')}.`;
  }
  const managers = users
    .map((user) => (user.id === after.id ? after : user))
    .filter((user) => user.active && user.permissions.includes('user.manage'));
  if (managers.length === 0) {
    return 'Someone active must keep the permission to manage users, or nobody could add or fix users.';
  }
  return null;
}
