import type { QueryClient } from '@tanstack/react-query';
import { redirect, type RouteObject } from 'react-router';

import { calendarMonthsQuery } from '@/features/calendar';
import { currenciesQuery, exchangeRatesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';
import { partnerOptionsQuery } from '@/features/partners';
import { roomTypesQuery } from '@/features/room-types';

import { purchaseDetailQuery } from './api/purchase.queries';

export function purchaseRoutes(queryClient: QueryClient): RouteObject[] {
  const loadFormData = () =>
    Promise.all([
      queryClient.query(hotelOptionsQuery),
      queryClient.query(partnerOptionsQuery('vendors')),
      queryClient.query(roomTypesQuery),
      queryClient.query(currenciesQuery),
      queryClient.query(exchangeRatesQuery),
      queryClient.query(calendarMonthsQuery),
    ]);

  return [
    {
      index: true,
      loader: async () => {
        await Promise.all([
          queryClient.query(hotelOptionsQuery),
          queryClient.query(calendarMonthsQuery),
          queryClient.query(currenciesQuery),
        ]);
        return null;
      },
      lazy: { Component: async () => (await import('./pages/PurchasesPage')).PurchasesPage },
    },
    {
      path: 'new',
      loader: async () => {
        await loadFormData();
        return null;
      },
      lazy: { Component: async () => (await import('./pages/PurchaseFormPage')).NewPurchasePage },
    },
    {
      path: ':id',
      loader: async ({ params }) => {
        await Promise.all([
          queryClient.query(purchaseDetailQuery(params.id ?? '')),
          queryClient.query(calendarMonthsQuery),
          queryClient.query(roomTypesQuery),
          queryClient.query(currenciesQuery),
        ]);
        return null;
      },
      lazy: { Component: async () => (await import('./pages/PurchaseDetailPage')).PurchaseDetailPage },
    },
    {
      path: ':id/edit',
      loader: async ({ params }) => {
        const id = params.id ?? '';
        const [purchase] = await Promise.all([queryClient.query(purchaseDetailQuery(id)), loadFormData()]);
        // Only a Draft is editable in this form.
        return purchase.status === 'draft' ? null : redirect(`/purchases/${id}`);
      },
      lazy: { Component: async () => (await import('./pages/PurchaseFormPage')).EditPurchasePage },
    },
  ];
}
