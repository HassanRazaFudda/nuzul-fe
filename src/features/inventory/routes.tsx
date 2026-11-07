import type { QueryClient } from '@tanstack/react-query';
import type { RouteObject } from 'react-router';

import { calendarMonthsQuery } from '@/features/calendar';
import { hotelOptionsQuery } from '@/features/hotels';

import { poolDetailQuery } from './api/ledger.queries';

export function ledgerRoutes(queryClient: QueryClient): RouteObject[] {
  return [
    {
      index: true,
      loader: async () => {
        await Promise.all([queryClient.query(hotelOptionsQuery), queryClient.query(calendarMonthsQuery)]);
        return null;
      },
      lazy: { Component: async () => (await import('./pages/LedgerPage')).LedgerPage },
    },
    {
      path: ':hotelId/:roomTypeId',
      loader: async ({ params }) => {
        await Promise.all([
          queryClient.query(poolDetailQuery(params.hotelId ?? '', params.roomTypeId ?? '')),
          queryClient.query(calendarMonthsQuery),
        ]);
        return null;
      },
      lazy: { Component: async () => (await import('./pages/PoolPage')).PoolPage },
    },
  ];
}
