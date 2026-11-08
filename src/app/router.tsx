import type { QueryClient } from '@tanstack/react-query';
import { createBrowserRouter, type RouteObject } from 'react-router';

import { calendarRoutes } from '@/features/calendar';
import { contractRoutes } from '@/features/contracts';
import { currencyRoutes } from '@/features/currencies';
import { designSystemRoutes } from '@/features/design-system';
import { hotelRoutes } from '@/features/hotels';
import { ledgerRoutes } from '@/features/inventory';
import { overviewRoute } from '@/features/overview';
import { agentRoutes, vendorRoutes } from '@/features/partners';
import { purchaseRoutes } from '@/features/purchases';
import { roomTypeRoutes } from '@/features/room-types';
import { terminationRoutes } from '@/features/termination';

import { AppLayout } from './layout/AppLayout';
import { LoadingScreen } from './layout/LoadingScreen';
import { PLACEHOLDER_ITEMS } from './layout/navigation';
import { PlaceholderPage } from './layout/PlaceholderPage';
import { RouteErrorBoundary } from './layout/RouteErrorBoundary';

type CreateRouter = (routes: RouteObject[]) => ReturnType<typeof createBrowserRouter>;

export function createAppRouter(queryClient: QueryClient, createRouter: CreateRouter = createBrowserRouter) {
  return createRouter([
    {
      path: '/',
      Component: AppLayout,
      HydrateFallback: LoadingScreen,
      ErrorBoundary: RouteErrorBoundary,
      children: [
        {
          ErrorBoundary: RouteErrorBoundary,
          children: [
            overviewRoute(),
            {
              path: 'purchases',
              children: [...purchaseRoutes(queryClient), ...terminationRoutes(queryClient)],
            },
            { path: 'contracts', children: contractRoutes(queryClient) },
            { path: 'inventory', children: ledgerRoutes(queryClient) },
            { path: 'hotels', children: hotelRoutes(queryClient) },
            { path: 'vendors', children: vendorRoutes() },
            { path: 'agents', children: agentRoutes() },
            { path: 'room-types', children: roomTypeRoutes(queryClient) },
            { path: 'calendar', children: calendarRoutes(queryClient) },
            { path: 'currencies', children: currencyRoutes(queryClient) },
            { path: 'design', children: designSystemRoutes() },
            ...PLACEHOLDER_ITEMS.map((item) => ({
              path: item.path,
              element: <PlaceholderPage title={item.label} purpose={item.purpose} />,
            })),
            {
              path: '*',
              loader: () => {
                throw new Response('Not found', { status: 404 });
              },
            },
          ],
        },
      ],
    },
  ]);
}
