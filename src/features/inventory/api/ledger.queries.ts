import { keepPreviousData, queryOptions } from '@tanstack/react-query';

import { loadLedgerSources } from './ledger-sources.api';
import { ledgerApi } from './ledger.api';
import type { PoolListParams } from './ledger.schemas';

// The ledger is calculated from current records on every read, and purchases change from
// another feature, so a cached answer is never treated as fresh.
const ALWAYS_STALE = 0;

export const ledgerKeys = {
  all: ['ledger'] as const,
  list: (params: PoolListParams) => [...ledgerKeys.all, 'list', params] as const,
  overbookedCount: () => [...ledgerKeys.all, 'overbooked-count'] as const,
  season: () => [...ledgerKeys.all, 'season'] as const,
  pool: (hotelId: string, roomTypeId: string) => [...ledgerKeys.all, 'pool', hotelId, roomTypeId] as const,
  sources: () => [...ledgerKeys.all, 'sources'] as const,
};

/** The records behind every ledger figure, for previewing a change before it is saved. */
export const ledgerSourcesQuery = queryOptions({
  queryKey: ledgerKeys.sources(),
  queryFn: loadLedgerSources,
  staleTime: ALWAYS_STALE,
});

export const poolListQuery = (params: PoolListParams) =>
  queryOptions({
    queryKey: ledgerKeys.list(params),
    queryFn: () => ledgerApi.list(params),
    placeholderData: keepPreviousData,
    staleTime: ALWAYS_STALE,
  });

export const seasonPoolsQuery = queryOptions({
  queryKey: ledgerKeys.season(),
  queryFn: () => ledgerApi.season(),
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
