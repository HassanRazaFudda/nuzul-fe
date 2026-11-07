import { QueryClient } from '@tanstack/react-query';

import { isApiError } from '@/lib/api/api-error';

const NON_RETRYABLE = new Set([
  'unauthorized',
  'forbidden',
  'not_found',
  'validation',
  'conflict',
  'invalid_response',
]);
const QUERY_STALE_MS = 30_000;
const MAX_QUERY_RETRIES = 2;

export function createQueryClient({ retry = true }: { retry?: boolean } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_MS,
        retry: (failureCount, error) => {
          if (!retry || (isApiError(error) && NON_RETRYABLE.has(error.kind))) return false;
          return failureCount < MAX_QUERY_RETRIES;
        },
      },
      mutations: { retry: false }, // writes are not idempotent, so never auto-retry
    },
  });
}
