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
] as const;
export type RevisionAction = (typeof REVISION_ACTIONS)[number];

export const REVISION_ENTITIES = ['purchase', 'contract'] as const;
export type RevisionEntity = (typeof REVISION_ENTITIES)[number];

/** One saved version of a record. Append-only, like the audit log it will feed. */
export const revisionSchema = z.object({
  id: z.string(),
  entity: z.enum(REVISION_ENTITIES),
  entityId: z.string(),
  /** The version this change produced. */
  version: z.number().int(),
  at: z.iso.datetime(),
  action: z.enum(REVISION_ACTIONS),
  reason: z.string(),
  /** The record as it was before, kept for restore and for the audit log. */
  before: z.unknown(),
  totalBefore: z.string().nullable(),
  totalAfter: z.string().nullable(),
});
export type Revision = z.infer<typeof revisionSchema>;

export type RevisionInput = Omit<Revision, 'id' | 'at'>;
