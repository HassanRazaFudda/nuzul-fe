import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import type { PurchaseInput, PurchaseListParams } from './purchase.schemas';
import { purchasesApi } from './purchases.api';

export const purchaseKeys = {
  all: ['purchases'] as const,
  lists: () => [...purchaseKeys.all, 'list'] as const,
  list: (params: PurchaseListParams) => [...purchaseKeys.lists(), params] as const,
  confirmed: () => [...purchaseKeys.all, 'confirmed'] as const,
  detail: (id: string) => [...purchaseKeys.all, 'detail', id] as const,
};

export const purchaseListQuery = (params: PurchaseListParams) =>
  queryOptions({
    queryKey: purchaseKeys.list(params),
    queryFn: () => purchasesApi.list(params),
    placeholderData: keepPreviousData,
  });

export const purchaseDetailQuery = (id: string) =>
  queryOptions({
    queryKey: purchaseKeys.detail(id),
    queryFn: () => purchasesApi.get(id),
  });

export const confirmedPurchasesQuery = queryOptions({
  queryKey: purchaseKeys.confirmed(),
  queryFn: () => purchasesApi.confirmed(),
});

interface VersionedInput {
  id: string;
  version: number;
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: purchasesApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: purchaseKeys.all }),
  });
}

export function useUpdatePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version, input }: VersionedInput & { input: PurchaseInput }) =>
      purchasesApi.update(id, version, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: purchaseKeys.all }),
  });
}

export function useConfirmPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: VersionedInput) => purchasesApi.confirm(id, version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: purchaseKeys.all }),
  });
}

export function useCancelPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: VersionedInput) => purchasesApi.cancel(id, version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: purchaseKeys.all }),
  });
}

export function useRemovePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: VersionedInput) => purchasesApi.remove(id, version),
    // Not the detail query: the page showing it is still open, and it no longer exists.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: purchaseKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: purchaseKeys.confirmed() }),
      ]),
  });
}
