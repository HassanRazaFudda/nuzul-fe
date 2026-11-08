import type { QueryClient } from '@tanstack/react-query';
import type { RouteObject } from 'react-router';

import { signInChoicesQuery, userQuery, usersQuery } from './api/user.queries';

/** Mounted at /users. */
export function userRoutes(queryClient: QueryClient): RouteObject[] {
  return [
    {
      index: true,
      loader: async () => {
        await queryClient.query(usersQuery);
        return null;
      },
      lazy: { Component: async () => (await import('./pages/UsersPage')).UsersPage },
    },
    {
      path: ':id',
      loader: async ({ params }) => {
        await queryClient.query(userQuery(params.id ?? ''));
        return null;
      },
      lazy: { Component: async () => (await import('./pages/UserPage')).UserPage },
    },
  ];
}

/** Outside the app's layout: nobody is signed in yet. */
export function signInRoute(queryClient: QueryClient): RouteObject {
  return {
    path: '/sign-in',
    loader: async () => {
      await queryClient.query(signInChoicesQuery);
      return null;
    },
    lazy: { Component: async () => (await import('./pages/SignInPage')).SignInPage },
  };
}
