import { mockDb } from '@/mock-api/db';
import { assertCan, recordAudit } from '@/mock-api/session';

import { revisionSchema, type RevisionEntity, type RevisionInput } from './revision.schemas';

export interface AuditFilters {
  userId: string;
  entity: string;
  action: string;
  from: string;
  to: string;
}

export const revisionsApi = {
  /** One record's history, newest first. */
  list: async (entity: RevisionEntity, entityId: string) => {
    const all = await mockDb.list('revisions', revisionSchema);
    return all
      .filter((revision) => revision.entity === entity && revision.entityId === entityId)
      .sort((a, b) => b.at.localeCompare(a.at) || b.version - a.version);
  },

  /** The whole audit log, newest first. Needs `audit.view`. */
  audit: async (filters: AuditFilters) => {
    await assertCan('audit.view');
    const all = await mockDb.list('revisions', revisionSchema);
    return all
      .filter(
        (entry) =>
          (filters.userId === '' || entry.userId === filters.userId) &&
          (filters.entity === '' || entry.entity === filters.entity) &&
          (filters.action === '' || entry.action === filters.action) &&
          (filters.from === '' || entry.at.slice(0, 10) >= filters.from) &&
          (filters.to === '' || entry.at.slice(0, 10) < filters.to),
      )
      .sort((a, b) => b.at.localeCompare(a.at));
  },

  /** Called by the transports that change a record, as the server would in the same transaction. */
  record: (input: RevisionInput) => recordAudit(input),
};
