import type { QueryClient } from '@tanstack/react-query';
import { redirect, type RouteObject } from 'react-router';

import { agreementSettingsQuery } from '@/features/agreement';
import { calendarMonthsQuery } from '@/features/calendar';
import { currenciesQuery, exchangeRatesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';
import { partnerOptionsQuery } from '@/features/partners';
import { conversionRulesQuery, roomTypesQuery } from '@/features/room-types';

import { contractContextQuery, contractDetailQuery } from './api/contract.queries';

export function contractRoutes(queryClient: QueryClient): RouteObject[] {
  const loadFormData = (excludeId: string | null) =>
    Promise.all([
      queryClient.query(partnerOptionsQuery('agents')),
      queryClient.query(hotelOptionsQuery),
      queryClient.query(roomTypesQuery),
      queryClient.query(conversionRulesQuery),
      queryClient.query(currenciesQuery),
      queryClient.query(exchangeRatesQuery),
      queryClient.query(calendarMonthsQuery),
      queryClient.query(contractContextQuery(excludeId)),
    ]);

  return [
    {
      index: true,
      loader: async () => {
        await Promise.all([queryClient.query(hotelOptionsQuery), queryClient.query(currenciesQuery)]);
        return null;
      },
      lazy: { Component: async () => (await import('./pages/ContractsPage')).ContractsPage },
    },
    {
      path: 'new',
      loader: async () => {
        await loadFormData(null);
        return null;
      },
      lazy: { Component: async () => (await import('./pages/ContractFormPage')).NewContractPage },
    },
    {
      path: ':id',
      loader: async ({ params }) => {
        await Promise.all([
          queryClient.query(contractDetailQuery(params.id ?? '')),
          queryClient.query(calendarMonthsQuery),
          queryClient.query(roomTypesQuery),
          queryClient.query(conversionRulesQuery),
          queryClient.query(currenciesQuery),
        ]);
        return null;
      },
      lazy: { Component: async () => (await import('./pages/ContractDetailPage')).ContractDetailPage },
    },
    {
      path: ':id/print',
      loader: async ({ params }) => {
        await Promise.all([
          queryClient.query(agreementSettingsQuery),
          queryClient.query(contractDetailQuery(params.id ?? '')),
          queryClient.query(calendarMonthsQuery),
          queryClient.query(roomTypesQuery),
          queryClient.query(currenciesQuery),
        ]);
        return null;
      },
      lazy: { Component: async () => (await import('./pages/ContractPrintPage')).ContractPrintPage },
    },
    {
      path: ':id/edit',
      loader: async ({ params }) => {
        const id = params.id ?? '';
        const [contract] = await Promise.all([queryClient.query(contractDetailQuery(id)), loadFormData(id)]);
        // Drafts, and Confirmed contracts through the preview. The rest are history.
        return contract.status === 'draft' || contract.status === 'confirmed'
          ? null
          : redirect(`/contracts/${id}`);
      },
      lazy: { Component: async () => (await import('./pages/ContractFormPage')).EditContractPage },
    },
  ];
}
