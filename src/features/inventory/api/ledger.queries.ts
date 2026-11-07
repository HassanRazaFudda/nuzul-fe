import { keepPreviousData, queryOptions } from '@tanstack/react-query';

import { ledgerApi } from './ledger.api';
import type { PoolListParams } from './ledger.schemas';

// The ledger is calculated from current records on every read, and purchases change from
// another feature, so a cached answer is never treated as fresh.
const ALWAYS_STALE = 0;

export const ledgerKeys = {
  all: ['ledger'] as const,
  list: (params: PoolListParams) => [...ledgerKeys.all, 'list', params] as const,
  overbookedCount: () => [...ledgerKeys.all, 'overbooked-count'] as const,
  pool: (hotelId: string, roomTypeId: string) => [...ledgerKeys.all, 'pool', hotelId, roomTypeId] as const,
};

export const poolListQuery = (params: PoolListParams) =>
  queryOptions({
    queryKey: ledgerKeys.list(params),
    queryFn: () => ledgerApi.list(params),
    placeholderData: keepPreviousData,
    staleTime: ALWAYS_STALE,
  });

export const overbookedPoolsQuery = queryOptions({
  queryKey: ledgerKeys.overbookedCount(),
  queryFn: () => ledgerApi.overbookedCount(),
  staleTime: ALWAYS_STALE,
});

export const poolDetailQuery = (hotelId: string, roomTypeId: string) =>
  queryOptions({
    queryKey: ledgerKeys.pool(hotelId, roomTypeId),
    queryFn: () => ledgerApi.pool(hotelId, roomTypeId),
    staleTime: ALWAYS_STALE,
  });
