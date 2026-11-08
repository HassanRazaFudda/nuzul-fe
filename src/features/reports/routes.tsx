import type { QueryClient } from '@tanstack/react-query';
import type { RouteObject } from 'react-router';

import { calendarMonthsQuery } from '@/features/calendar';
import { currenciesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';

function loadFilters(queryClient: QueryClient) {
  return async () => {
    await Promise.all([
      queryClient.query(hotelOptionsQuery),
      queryClient.query(currenciesQuery),
      queryClient.query(calendarMonthsQuery),
    ]);
    return null;
  };
}

/** Mounted at /profit-loss. */
export function profitLossRoutes(queryClient: QueryClient): RouteObject[] {
  return [
    {
      index: true,
      loader: loadFilters(queryClient),
      lazy: { Component: async () => (await import('./pages/ProfitLossPage')).ProfitLossPage },
    },
  ];
}

/** Mounted at /reports. */
export function reportRoutes(queryClient: QueryClient): RouteObject[] {
  const page = (path: string, load: () => Promise<RouteObject['Component']>): RouteObject => ({
    path,
    loader: loadFilters(queryClient),
    lazy: { Component: load },
  });
  return [
    {
      index: true,
      lazy: { Component: async () => (await import('./pages/ReportsIndexPage')).ReportsIndexPage },
    },
    page('contracts', async () => (await import('./pages/ContractProfitPage')).ContractProfitPage),
    page('vendors', async () => (await import('./pages/VendorMarginPage')).VendorMarginPage),
    page('sales', async () => (await import('./pages/SalesReportPage')).SalesReportPage),
    page('inventory', async () => (await import('./pages/InventoryReportPage')).InventoryReportPage),
    page('exposure', async () => (await import('./pages/InventoryReportPage')).ExposureReportPage),
  ];
}
