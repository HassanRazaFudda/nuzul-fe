import { z } from 'zod';

export const REVISION_ACTIONS = [
  'created',
  'edited',
  'confirmed',
  'cancelled',
  'terminated',
  'vendor-released',
  'line-cancelled',
  're-sourced',
  'overbooking-accepted',
  'locked',
  'unlocked',
  'restored',
  'deleted',
  'activated',
  'deactivated',
  'rate-added',
  'permissions-changed',
  'signed-in',
  'signed-out',
] as const;
export type RevisionAction = (typeof REVISION_ACTIONS)[number];

export const REVISION_ENTITIES = [
  'purchase',
  'contract',
  'hotel',
  'city',
  'vendor',
  'agent',
  'roomType',
  'conversionRule',
  'calendarMonth',
  'currency',
  'user',
  'session',
] as const;
export type RevisionEntity = (typeof REVISION_ENTITIES)[number];

/** One entry in the audit log. Append-only: nothing changes or removes an entry. */
export const revisionSchema = z.object({
  id: z.string(),
  entity: z.enum(REVISION_ENTITIES),
  entityId: z.string(),
  /** The version this change produced, for records that keep one; otherwise 0. */
  version: z.number().int(),
  at: z.iso.datetime(),
  action: z.enum(REVISION_ACTIONS),
  reason: z.string(),
  /** Null for entries saved before sign-in existed. */
  userId: z.string().nullable().default(null),
  /** The record as it was before, kept for restore and for the audit log. */
  before: z.unknown(),
  after: z.unknown().optional(),
  totalBefore: z.string().nullable(),
  totalAfter: z.string().nullable(),
});
export type Revision = z.infer<typeof revisionSchema>;

export type RevisionInput = Omit<Revision, 'id' | 'at' | 'userId'>;
