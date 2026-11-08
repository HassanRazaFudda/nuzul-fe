import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import type { PurchaseInput, PurchaseListParams } from './purchase.schemas';
import { purchasesApi } from './purchases.api';

export const purchaseKeys = {
  all: ['purchases'] as const,
  lists: () => [...purchaseKeys.all, 'list'] as const,
  list: (params: PurchaseListParams) => [...purchaseKeys.lists(), params] as const,
  detail: (id: string) => [...purchaseKeys.all, 'detail', id] as const,
  adjustments: (id: string) => [...purchaseKeys.all, 'adjustments', id] as const,
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

export const adjustmentsQuery = (purchaseId: string) =>
  queryOptions({
    queryKey: purchaseKeys.adjustments(purchaseId),
    queryFn: () => purchasesApi.adjustments(purchaseId),
  });

interface VersionedInput {
  id: string;
  version: number;
}

interface ReasonedInput extends VersionedInput {
  reason: string;
  /** The ledger stamp the preview was worked out from. */
  stamp: string;
}

function useRefreshPurchases() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: purchaseKeys.all });
}

/** A change to a Confirmed purchase moves the ledger, contracts and history too. */
function useRefreshEverything() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}

export function useCreatePurchase() {
  const refresh = useRefreshPurchases();
  return useMutation({ mutationFn: purchasesApi.create, onSuccess: refresh });
}

export function useUpdatePurchase() {
  const refresh = useRefreshPurchases();
  return useMutation({
    mutationFn: ({ id, version, input }: VersionedInput & { input: PurchaseInput }) =>
      purchasesApi.update(id, version, input),
    onSuccess: refresh,
  });
}

export function useUpdateConfirmedPurchase() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: ({ id, version, input, reason, stamp }: ReasonedInput & { input: PurchaseInput }) =>
      purchasesApi.updateConfirmed(id, version, input, reason, stamp),
    onSuccess: refresh,
  });
}

export function useConfirmPurchase() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: ({ id, version }: VersionedInput) => purchasesApi.confirm(id, version),
    onSuccess: refresh,
  });
}

export function useCancelPurchase() {
  const refresh = useRefreshEverything();
  return useMutation({
    mutationFn: ({ id, version, reason, stamp }: ReasonedInput) =>
      purchasesApi.cancel(id, version, reason, stamp),
    onSuccess: refresh,
  });
}

export function useRemovePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: VersionedInput) => purchasesApi.remove(id, version),
    // Not the detail query: the page showing it is still open, and it no longer exists.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: purchaseKeys.lists() }),
  });
}

export function useSetPurchaseLocked() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version, locked }: VersionedInput & { locked: boolean }) =>
      purchasesApi.setLocked(id, version, locked),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useRestorePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version, reason, stamp }: ReasonedInput) =>
      purchasesApi.restore(id, version, reason, stamp),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
