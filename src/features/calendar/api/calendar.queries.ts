import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { calendarApi } from './calendar.api';

export const calendarKeys = {
  all: ['calendar'] as const,
  months: () => [...calendarKeys.all, 'months'] as const,
};

export const calendarMonthsQuery = queryOptions({
  queryKey: calendarKeys.months(),
  queryFn: () => calendarApi.list(),
  staleTime: 10 * 60_000,
});

export function useSaveCalendarMonth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: calendarApi.save,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: calendarKeys.all }),
  });
}

export function useRemoveCalendarMonth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: calendarApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: calendarKeys.all }),
  });
}
