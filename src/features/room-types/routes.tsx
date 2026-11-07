import type { QueryClient } from '@tanstack/react-query';
import type { RouteObject } from 'react-router';

import { hotelOptionsQuery } from '@/features/hotels';

import { conversionRulesQuery, roomTypesQuery } from './api/room-type.queries';

export function roomTypeRoutes(queryClient: QueryClient): RouteObject[] {
  return [
    {
      index: true,
      loader: async () => {
        await Promise.all([
          queryClient.query(roomTypesQuery),
          queryClient.query(conversionRulesQuery),
          queryClient.query(hotelOptionsQuery),
        ]);
        return null;
      },
      lazy: { Component: async () => (await import('./pages/RoomTypesPage')).RoomTypesPage },
    },
  ];
}
