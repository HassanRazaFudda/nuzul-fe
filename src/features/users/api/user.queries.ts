import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { sessionKeys } from '@/lib/auth/session';

import { usersApi } from './users.api';

export const userKeys = {
  all: ['users'] as const,
  list: () => [...userKeys.all, 'list'] as const,
  detail: (id: string) => [...userKeys.all, 'detail', id] as const,
  choices: () => [...userKeys.all, 'sign-in-choices'] as const,
};

export const usersQuery = queryOptions({ queryKey: userKeys.list(), queryFn: usersApi.list });
export const userQuery = (id: string) =>
  queryOptions({ queryKey: userKeys.detail(id), queryFn: () => usersApi.get(id) });
export const signInChoicesQuery = queryOptions({
  queryKey: userKeys.choices(),
  queryFn: usersApi.signInChoices,
});

function useRefreshUsers() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: userKeys.all }),
      queryClient.invalidateQueries({ queryKey: sessionKeys.all }),
    ]);
}

export function useCreateUser() {
  const refresh = useRefreshUsers();
  return useMutation({ mutationFn: usersApi.create, onSuccess: refresh });
}

export function useSetUserActive() {
  const refresh = useRefreshUsers();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => usersApi.setActive(id, active),
    onSuccess: refresh,
  });
}

export function useSetPermissions() {
  const refresh = useRefreshUsers();
  return useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: string[] }) =>
      usersApi.setPermissions(id, permissions),
    onSuccess: refresh,
  });
}

/** Changing who is signed in changes what every screen may show, so nothing cached is kept. */
export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.signIn,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.signOut,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
