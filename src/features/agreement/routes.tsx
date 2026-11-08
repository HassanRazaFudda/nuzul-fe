import type { QueryClient } from '@tanstack/react-query';
import type { RouteObject } from 'react-router';

import { roomTypesQuery } from '@/features/room-types';

import { agreementSettingsQuery } from './api/agreement.queries';

/** Mounted at /settings/agreement. */
export function agreementRoutes(queryClient: QueryClient): RouteObject[] {
  return [
    {
      index: true,
      loader: async () => {
        await Promise.all([queryClient.query(agreementSettingsQuery), queryClient.query(roomTypesQuery)]);
        return null;
      },
      lazy: {
        Component: async () => (await import('./pages/AgreementSettingsPage')).AgreementSettingsPage,
      },
    },
  ];
}
