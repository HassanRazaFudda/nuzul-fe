import type { QueryClient } from '@tanstack/react-query';
import type { RouteObject } from 'react-router';

import { calendarMonthsQuery } from '@/features/calendar';
import { currenciesQuery, exchangeRatesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';
import { ledgerSourcesQuery } from '@/features/inventory';
import { purchaseDetailQuery } from '@/features/purchases';
import { conversionRulesQuery, roomTypesQuery } from '@/features/room-types';

/** Mounted under /purchases, since a termination is something done to a purchase. */
export function terminationRoutes(queryClient: QueryClient): RouteObject[] {
  return [
    {
      path: ':id/terminate',
      loader: async ({ params }) => {
        await Promise.all([
          queryClient.query(purchaseDetailQuery(params.id ?? '')),
          queryClient.query(ledgerSourcesQuery),
          queryClient.query(hotelOptionsQuery),
          queryClient.query(roomTypesQuery),
          queryClient.query(conversionRulesQuery),
          queryClient.query(currenciesQuery),
          queryClient.query(exchangeRatesQuery),
          queryClient.query(calendarMonthsQuery),
        ]);
        return null;
      },
      lazy: {
        Component: async () => (await import('./pages/TerminatePurchasePage')).TerminatePurchasePage,
      },
    },
  ];
}
