/**
 * The prototype's stand-in for the server's session and audit log. There is no password:
 * choosing a user signs in. Real authentication, and checks a browser cannot get round,
 * arrive with the backend (docs/security-and-permissions.md).
 */

import { z } from 'zod';

import { ApiError } from '@/lib/api/api-error';
import type { Permission } from '@/lib/auth/permissions';

import { mockDb, type CollectionName, type StoredRecord } from './db';

export const userRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  permissions: z.array(z.string()),
});
export type UserRecord = z.infer<typeof userRecordSchema>;

const sessionSchema = z.object({ id: z.literal('current'), userId: z.string().nullable() });

export async function currentUser(): Promise<UserRecord | null> {
  const session = await mockDb.get('session', 'current', sessionSchema);
  if (!session?.userId) return null;
  const user = await mockDb.get('users', session.userId, userRecordSchema);
  return user?.active ? user : null;
}

/** The server's check on every endpoint. The screens hide controls only as a courtesy. */
export async function assertCan(...permissions: Permission[]): Promise<UserRecord> {
  const user = await currentUser();
  if (!user) throw new ApiError({ kind: 'unauthorized', message: 'Not signed in' });
  const missing = permissions.filter((permission) => !user.permissions.includes(permission));
  if (missing.length > 0) {
    throw new ApiError({ kind: 'forbidden', message: `Missing permission: ${missing.join(', ')}` });
  }
  return user;
}

export async function setSession(userId: string | null) {
  await mockDb.put('session', { id: 'current', userId });
}

export interface AuditInput {
  entity: string;
  entityId: string;
  /** The version the change produced, for records that keep one. */
  version?: number;
  action: string;
  reason?: string;
  before: unknown;
  after?: unknown;
  totalBefore?: string | null;
  totalAfter?: string | null;
}

/**
 * Appends to the audit log, with the signed-in user, as the server does in the same
 * transaction as the change. Nothing can change or remove an entry.
 */
export async function recordAudit(input: AuditInput) {
  const user = await currentUser();
  await mockDb.put('revisions', {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    userId: user?.id ?? null,
    version: 0,
    reason: '',
    totalBefore: null,
    totalAfter: null,
    ...input,
  });
}

/** A setup change as the server makes it: check the permission, save, and log it. */
export async function saveAudited<TRecord extends StoredRecord>(
  permission: Permission,
  collection: CollectionName,
  entity: string,
  action: string,
  record: TRecord,
): Promise<TRecord> {
  await assertCan(permission);
  const before: unknown = await mockDb.get(collection, record.id, z.unknown());
  const saved = await mockDb.put(collection, record);
  await recordAudit({ entity, entityId: record.id, action, before: before ?? null, after: saved });
  return saved;
}

export async function removeAudited(
  permission: Permission,
  collection: CollectionName,
  entity: string,
  id: string,
) {
  await assertCan(permission);
  const before: unknown = await mockDb.get(collection, id, z.unknown());
  await mockDb.remove(collection, id);
  await recordAudit({ entity, entityId: id, action: 'deleted', before: before ?? null, after: null });
}
