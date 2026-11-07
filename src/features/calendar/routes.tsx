import type { QueryClient } from '@tanstack/react-query';
import type { RouteObject } from 'react-router';

import { calendarMonthsQuery } from './api/calendar.queries';

export function calendarRoutes(queryClient: QueryClient): RouteObject[] {
  return [
    {
      index: true,
      loader: async () => {
        await queryClient.query(calendarMonthsQuery);
        return null;
      },
      lazy: { Component: async () => (await import('./pages/CalendarPage')).CalendarPage },
    },
  ];
}
