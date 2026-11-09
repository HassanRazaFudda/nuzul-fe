import type { ListParams } from '@/lib/api/pagination';

import type { LedgerOutput } from '../domain/ledger-engine';
import type { Pool, PoolFigures, SeasonNight } from '../domain/pools';

export const POOL_SORT_FIELDS = ['state', 'hotel', 'roomType'] as const;
export type PoolSortField = (typeof POOL_SORT_FIELDS)[number];

export const POOL_STATE_FILTERS = ['all', 'overbooked', 'full', 'available'] as const;
export type PoolStateFilter = (typeof POOL_STATE_FILTERS)[number];

export interface PoolListParams extends ListParams<PoolSortField> {
  status: PoolStateFilter;
  hotelId: string;
}

export type PoolSummary = PoolFigures & {
  id: string;
  hotelId: string;
  roomTypeId: string;
  hotelName: string;
  roomTypeName: string;
  roomNightsPurchased: number;
  roomNightsSold: number;
};

export interface SeasonOverview {
  pools: PoolSummary[];
  nights: SeasonNight[];
}

export interface PoolDetail {
  hotelId: string;
  roomTypeId: string;
  hotelName: string;
  roomTypeName: string;
  pool: Pool;
  /** Null when nothing Confirmed is on this pool. */
  ledger: LedgerOutput | null;
  figures: PoolFigures | null;
}
