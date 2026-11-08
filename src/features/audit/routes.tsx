import type { RouteObject } from 'react-router';

export function auditRoutes(): RouteObject[] {
  return [
    { index: true, lazy: { Component: async () => (await import('./pages/AuditLogPage')).AuditLogPage } },
  ];
}
