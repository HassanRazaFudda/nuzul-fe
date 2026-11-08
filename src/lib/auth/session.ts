import { queryOptions, useQuery } from '@tanstack/react-query';

import { mockDb } from '@/mock-api/db';
import { currentUser, userRecordSchema } from '@/mock-api/session';

import type { Permission } from './permissions';

export const sessionKeys = {
  all: ['session'] as const,
  current: ['session', 'current'] as const,
  names: ['session', 'user-names'] as const,
};

/** Every user's name by id, for showing who did what. Anyone signed in may see names. */
export const userNamesQuery = queryOptions({
  queryKey: sessionKeys.names,
  queryFn: async () =>
    Object.fromEntries((await mockDb.list('users', userRecordSchema)).map((user) => [user.id, user.name])),
});

/** Who is signed in. Null when nobody is. */
export const currentUserQuery = queryOptions({
  queryKey: sessionKeys.current,
  queryFn: currentUser,
  staleTime: Number.POSITIVE_INFINITY,
});

export function useCurrentUser() {
  return useQuery(currentUserQuery).data ?? null;
}

/**
 * Whether the signed-in user holds a permission. Screens use it to hide or disable controls
 * as a courtesy; the server checks every request itself.
 */
export function useCan() {
  const user = useCurrentUser();
  return (permission: Permission) => user?.permissions.includes(permission) ?? false;
}
