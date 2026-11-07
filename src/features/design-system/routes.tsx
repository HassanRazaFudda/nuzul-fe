import type { RouteObject } from 'react-router';

export function designSystemRoutes(): RouteObject[] {
  return [
    {
      index: true,
      lazy: { Component: async () => (await import('./pages/DesignSystemPage')).DesignSystemPage },
    },
  ];
}
