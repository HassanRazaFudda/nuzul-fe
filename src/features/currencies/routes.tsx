import type { QueryClient } from '@tanstack/react-query';
import type { RouteObject } from 'react-router';

import { currenciesQuery, exchangeRatesQuery } from './api/currency.queries';

export function currencyRoutes(queryClient: QueryClient): RouteObject[] {
  return [
    {
      index: true,
      loader: async () => {
        await Promise.all([queryClient.query(currenciesQuery), queryClient.query(exchangeRatesQuery)]);
        return null;
      },
      lazy: { Component: async () => (await import('./pages/CurrenciesPage')).CurrenciesPage },
    },
  ];
}
