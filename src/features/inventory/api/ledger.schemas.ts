import { z } from 'zod';

import type { ListParams } from '@/lib/api/pagination';

import type { LedgerOutput } from '../domain/ledger-engine';
import type { Pool, PoolFigures } from '../domain/pools';

/** Only what the ledger needs from a contract: this feature does not depend on contracts. */
export const contractSalesSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: z.string(),
  hotels: z.array(
    z.object({
      hotelId: z.string(),
      checkIn: z.iso.date(),
      checkOut: z.iso.date(),
      lines: z.array(z.object({ sourceTypeId: z.string(), rooms: z.number().int() })),
    }),
  ),
});

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
