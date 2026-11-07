import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import type { Partner, PartnerKind, PartnerListParams, PartnerUpsertPayload } from './partner.schemas';
import { partnersApi } from './partners.api';

export const partnerKeys = {
  all: (kind: PartnerKind) => ['partners', kind] as const,
  lists: (kind: PartnerKind) => [...partnerKeys.all(kind), 'list'] as const,
  list: (kind: PartnerKind, params: PartnerListParams) => [...partnerKeys.lists(kind), params] as const,
  options: (kind: PartnerKind) => [...partnerKeys.all(kind), 'options'] as const,
};

export const partnerListQuery = (kind: PartnerKind, params: PartnerListParams) =>
  queryOptions({
    queryKey: partnerKeys.list(kind, params),
    queryFn: () => partnersApi.list(kind, params),
    placeholderData: keepPreviousData,
  });

export const partnerOptionsQuery = (kind: PartnerKind) =>
  queryOptions({
    queryKey: partnerKeys.options(kind),
    queryFn: () => partnersApi.options(kind),
    staleTime: 10 * 60_000,
  });

export function useSavePartner(kind: PartnerKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ partner, payload }: { partner: Partner | null; payload: PartnerUpsertPayload }) =>
      partner ? partnersApi.update(kind, partner, payload) : partnersApi.create(kind, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: partnerKeys.all(kind) }),
  });
}

export function useSetPartnerActive(kind: PartnerKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ partner, active }: { partner: Partner; active: boolean }) =>
      partnersApi.setActive(kind, partner, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: partnerKeys.all(kind) }),
  });
}
