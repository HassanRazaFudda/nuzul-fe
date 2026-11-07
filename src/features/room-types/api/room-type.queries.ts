import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { roomTypesApi } from './room-types.api';

const REFERENCE_STALE_MS = 10 * 60_000;

export const roomTypeKeys = {
  all: ['room-types'] as const,
  list: () => [...roomTypeKeys.all, 'list'] as const,
  rules: () => [...roomTypeKeys.all, 'rules'] as const,
};

export const roomTypesQuery = queryOptions({
  queryKey: roomTypeKeys.list(),
  queryFn: () => roomTypesApi.list(),
  staleTime: REFERENCE_STALE_MS,
});

export const conversionRulesQuery = queryOptions({
  queryKey: roomTypeKeys.rules(),
  queryFn: () => roomTypesApi.rules(),
  staleTime: REFERENCE_STALE_MS,
});

export function useSaveRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: roomTypesApi.save,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomTypeKeys.list() }),
  });
}

export function useSaveConversionRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: roomTypesApi.saveRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomTypeKeys.rules() }),
  });
}

export function useRemoveConversionRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: roomTypesApi.removeRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomTypeKeys.rules() }),
  });
}
