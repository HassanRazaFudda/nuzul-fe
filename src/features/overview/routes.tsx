import type { RouteObject } from 'react-router';

export function overviewRoute(): RouteObject {
  return {
    index: true,
    lazy: { Component: async () => (await import('./pages/OverviewPage')).OverviewPage },
  };
}
