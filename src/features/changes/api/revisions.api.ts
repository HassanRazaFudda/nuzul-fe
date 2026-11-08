import { mockDb } from '@/mock-api/db';

import { revisionSchema, type RevisionEntity, type RevisionInput } from './revision.schemas';

export const revisionsApi = {
  /** Newest first. */
  list: async (entity: RevisionEntity, entityId: string) => {
    const all = await mockDb.list('revisions', revisionSchema);
    return all
      .filter((revision) => revision.entity === entity && revision.entityId === entityId)
      .sort((a, b) => b.version - a.version || b.at.localeCompare(a.at));
  },

  /** Called by the transports that change a record, as the server would in the same transaction. */
  record: (input: RevisionInput) =>
    mockDb.put('revisions', { ...input, id: crypto.randomUUID(), at: new Date().toISOString() }),
};
