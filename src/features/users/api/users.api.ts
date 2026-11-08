import { ApiError } from '@/lib/api/api-error';
import { isPermission } from '@/lib/auth/permissions';
import { mockDb } from '@/mock-api/db';
import {
  assertCan,
  currentUser,
  recordAudit,
  setSession,
  userRecordSchema,
  type UserRecord,
} from '@/mock-api/session';

import { changeProblem } from '../domain/user-rules';

async function actor(): Promise<UserRecord> {
  const user = await currentUser();
  if (!user) throw new ApiError({ kind: 'unauthorized', message: 'Not signed in' });
  return user;
}

/** Seeing users needs one of the two administration permissions. */
async function assertCanSeeUsers() {
  const user = await actor();
  if (!user.permissions.includes('user.manage') && !user.permissions.includes('permission.assign')) {
    throw new ApiError({ kind: 'forbidden', message: 'Missing permission: user.manage' });
  }
  return user;
}

async function saveUser(before: UserRecord | null, after: UserRecord) {
  const user = await actor();
  const users = await mockDb.list('users', userRecordSchema);
  const problem = changeProblem(user, users, before ?? { ...after, active: false, permissions: [] }, after);
  if (problem) throw new ApiError({ kind: 'forbidden', message: problem });
  const saved = await mockDb.put('users', after);
  const action = !before
    ? 'created'
    : before.active !== after.active
      ? after.active
        ? 'activated'
        : 'deactivated'
      : before.permissions.join() !== after.permissions.join()
        ? 'permissions-changed'
        : 'edited';
  await recordAudit({ entity: 'user', entityId: after.id, action, before, after: saved });
  return saved;
}

async function existing(id: string) {
  const user = await mockDb.get('users', id, userRecordSchema);
  if (!user) throw new ApiError({ kind: 'not_found', message: 'User not found' });
  return user;
}

export const usersApi = {
  /** Who can sign in. In the prototype anyone may choose; the backend asks for a password. */
  signInChoices: async () =>
    (await mockDb.list('users', userRecordSchema))
      .filter((user) => user.active)
      .sort((a, b) => a.name.localeCompare(b.name)),

  list: async () => {
    await assertCanSeeUsers();
    return (await mockDb.list('users', userRecordSchema)).sort((a, b) => a.name.localeCompare(b.name));
  },

  get: async (id: string) => {
    await assertCanSeeUsers();
    return existing(id);
  },

  create: async (name: string) => {
    await assertCan('user.manage');
    return saveUser(null, { id: crypto.randomUUID(), name, active: true, permissions: [] });
  },

  rename: async (id: string, name: string) => {
    await assertCan('user.manage');
    return saveUser(await existing(id), { ...(await existing(id)), name });
  },

  setActive: async (id: string, active: boolean) =>
    saveUser(await existing(id), { ...(await existing(id)), active }),

  setPermissions: async (id: string, permissions: string[]) =>
    saveUser(await existing(id), { ...(await existing(id)), permissions: permissions.filter(isPermission) }),

  signIn: async (userId: string) => {
    const user = await existing(userId);
    if (!user.active) throw new ApiError({ kind: 'forbidden', message: 'This user is deactivated' });
    await setSession(userId);
    await recordAudit({
      entity: 'session',
      entityId: userId,
      action: 'signed-in',
      before: null,
      after: null,
    });
  },

  signOut: async () => {
    const user = await currentUser();
    if (user) {
      await recordAudit({
        entity: 'session',
        entityId: user.id,
        action: 'signed-out',
        before: null,
        after: null,
      });
    }
    await setSession(null);
  },
};
