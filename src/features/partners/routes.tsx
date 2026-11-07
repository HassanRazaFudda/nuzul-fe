import type { RouteObject } from 'react-router';

export function vendorRoutes(): RouteObject[] {
  return [
    { index: true, lazy: { Component: async () => (await import('./pages/VendorsPage')).VendorsPage } },
  ];
}

export function agentRoutes(): RouteObject[] {
  return [{ index: true, lazy: { Component: async () => (await import('./pages/AgentsPage')).AgentsPage } }];
}
