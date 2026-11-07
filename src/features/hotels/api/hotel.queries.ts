import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import type { Hotel, HotelListParams, HotelUpsertPayload } from './hotel.schemas';
import { hotelsApi } from './hotels.api';

const REFERENCE_STALE_MS = 10 * 60_000;

export const hotelKeys = {
  all: ['hotels'] as const,
  lists: () => [...hotelKeys.all, 'list'] as const,
  list: (params: HotelListParams) => [...hotelKeys.lists(), params] as const,
  options: () => [...hotelKeys.all, 'options'] as const,
  cities: () => [...hotelKeys.all, 'cities'] as const,
};

export const hotelListQuery = (params: HotelListParams) =>
  queryOptions({
    queryKey: hotelKeys.list(params),
    queryFn: () => hotelsApi.list(params),
    placeholderData: keepPreviousData,
  });

export const hotelOptionsQuery = queryOptions({
  queryKey: hotelKeys.options(),
  queryFn: () => hotelsApi.options(),
  staleTime: REFERENCE_STALE_MS,
});

export const cityOptionsQuery = queryOptions({
  queryKey: hotelKeys.cities(),
  queryFn: () => hotelsApi.cities(),
  staleTime: REFERENCE_STALE_MS,
});

export function useSaveHotel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ hotel, payload }: { hotel: Hotel | null; payload: HotelUpsertPayload }) =>
      hotel ? hotelsApi.update(hotel, payload) : hotelsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hotelKeys.all }),
  });
}

export function useSetHotelActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ hotel, active }: { hotel: Hotel; active: boolean }) => hotelsApi.setActive(hotel, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hotelKeys.all }),
  });
}

export function useAddCity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: hotelsApi.addCity,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hotelKeys.cities() }),
  });
}
