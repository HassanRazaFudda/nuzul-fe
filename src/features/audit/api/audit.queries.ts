import { queryOptions } from '@tanstack/react-query';

import { revisionsApi, type AuditFilters } from '@/features/changes';

export const auditKeys = {
  all: ['audit'] as const,
  list: (filters: AuditFilters) => [...auditKeys.all, filters] as const,
};

/** Every change is new, so the log is always read fresh. */
export const auditQuery = (filters: AuditFilters) =>
  queryOptions({
    queryKey: auditKeys.list(filters),
    queryFn: () => revisionsApi.audit(filters),
    staleTime: 0,
  });
