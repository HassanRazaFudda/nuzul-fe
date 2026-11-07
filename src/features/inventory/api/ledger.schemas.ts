import { z } from 'zod';

import type { ListParams } from '@/lib/api/pagination';

import type { LedgerOutput } from '../domain/ledger-engine';
import type { Pool, PoolFigures } from '../domain/pools';

/** Stands in for Confirmed contract lines until Phase 4, which deletes it. */
export const sampleSaleSchema = z.object({
  id: z.string(),
  reference: z.string(),
  hotelId: z.string(),
  roomTypeId: z.string(),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  rooms: z.number().int(),
});
export type SampleSale = z.infer<typeof sampleSaleSchema>;
export type SampleSaleInput = Omit<SampleSale, 'id' | 'reference'>;

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
};

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
