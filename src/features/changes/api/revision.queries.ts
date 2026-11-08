import { queryOptions } from '@tanstack/react-query';

import type { RevisionEntity } from './revision.schemas';
import { revisionsApi } from './revisions.api';

export const revisionKeys = {
  all: ['revisions'] as const,
  of: (entity: RevisionEntity, entityId: string) => [...revisionKeys.all, entity, entityId] as const,
};

export const revisionsQuery = (entity: RevisionEntity, entityId: string) =>
  queryOptions({
    queryKey: revisionKeys.of(entity, entityId),
    queryFn: () => revisionsApi.list(entity, entityId),
    staleTime: 0,
  });
