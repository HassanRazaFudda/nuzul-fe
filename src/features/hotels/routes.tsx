import type { QueryClient } from '@tanstack/react-query';
import type { RouteObject } from 'react-router';

import { currenciesQuery } from '@/features/currencies';

import { cityOptionsQuery } from './api/hotel.queries';

export function hotelRoutes(queryClient: QueryClient): RouteObject[] {
  return [
    {
      index: true,
      loader: async () => {
        await Promise.all([queryClient.query(cityOptionsQuery), queryClient.query(currenciesQuery)]);
        return null;
      },
      lazy: { Component: async () => (await import('./pages/HotelsPage')).HotelsPage },
    },
  ];
}
