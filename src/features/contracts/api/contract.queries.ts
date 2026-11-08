import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import type { ContractInput, ContractListParams } from './contract.schemas';
import { contractsApi } from './contracts.api';

// Tags and warnings depend on purchases, which change from another feature, so a cached
// answer is never treated as fresh.
const ALWAYS_STALE = 0;

export const contractKeys = {
  all: ['contracts'] as const,
  lists: () => [...contractKeys.all, 'list'] as const,
  list: (params: ContractListParams) => [...contractKeys.lists(), params] as const,
  detail: (id: string) => [...contractKeys.all, 'detail', id] as const,
  context: (excludeId: string | null) => [...contractKeys.all, 'context', excludeId] as const,
};

export const contractListQuery = (params: ContractListParams) =>
  queryOptions({
    queryKey: contractKeys.list(params),
    queryFn: () => contractsApi.list(params),
    placeholderData: keepPreviousData,
    staleTime: ALWAYS_STALE,
  });

export const contractDetailQuery = (id: string) =>
  queryOptions({
    queryKey: contractKeys.detail(id),
    queryFn: () => contractsApi.get(id),
    staleTime: ALWAYS_STALE,
  });

export const contractContextQuery = (excludeId: string | null) =>
  queryOptions({
    queryKey: contractKeys.context(excludeId),
    queryFn: () => contractsApi.context(excludeId),
    staleTime: ALWAYS_STALE,
  });

interface VersionedInput {
  id: string;
  version: number;
}

/** A change moves the ledger, purchases' free rooms and history too, so everything is refreshed. */
function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}

export function useCreateContract() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: contractsApi.create, onSuccess: refresh });
}

export function useUpdateContract() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, version, input }: VersionedInput & { input: ContractInput }) =>
      contractsApi.update(id, version, input),
    onSuccess: refresh,
  });
}

export function useUpdateConfirmedContract() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({
      id,
      version,
      input,
      reason,
      stamp,
    }: VersionedInput & { input: ContractInput; reason: string; stamp: string }) =>
      contractsApi.updateConfirmed(id, version, input, reason, stamp),
    onSuccess: refresh,
  });
}

export function useConfirmContract() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, version }: VersionedInput) => contractsApi.confirm(id, version),
    onSuccess: refresh,
  });
}

export function useCancelContract() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, version, reason }: VersionedInput & { reason: string }) =>
      contractsApi.cancel(id, version, reason),
    onSuccess: refresh,
  });
}

export function useRemoveContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: VersionedInput) => contractsApi.remove(id, version),
    // Not the detail query: the page showing it is still open, and it no longer exists.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: contractKeys.lists() }),
  });
}
