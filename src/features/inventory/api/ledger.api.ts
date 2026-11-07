import { hotelSchema } from '@/features/hotels';
import { purchasesApi } from '@/features/purchases';
import { roomTypeSchema } from '@/features/room-types';
import { mockDb } from '@/mock-api/db';
import { pageOf } from '@/mock-api/list-query';

import { buildPools, poolFigures, poolLedger, type Pool, type PoolSaleInput } from '../domain/pools';
import {
  sampleSaleSchema,
  type PoolDetail,
  type PoolListParams,
  type PoolSummary,
  type SampleSaleInput,
} from './ledger.schemas';

/** The one place the ledger reads sales from. Phase 4 points it at Confirmed contract lines. */
function saleEntries(): Promise<PoolSaleInput[]> {
  return mockDb.list('sampleSales', sampleSaleSchema);
}

async function namesLookup() {
  const [hotels, roomTypes] = await Promise.all([
    mockDb.list('hotels', hotelSchema),
    mockDb.list('roomTypes', roomTypeSchema),
  ]);
  return {
    hotelName: (id: string) => hotels.find((hotel) => hotel.id === id)?.name ?? 'Unknown hotel',
    roomTypeName: (id: string) => roomTypes.find((type) => type.id === id)?.name ?? 'Unknown room type',
  };
}

async function currentPools(): Promise<Pool[]> {
  const [purchases, sales] = await Promise.all([purchasesApi.confirmed(), saleEntries()]);
  return buildPools(purchases, sales);
}

async function poolSummaries(): Promise<PoolSummary[]> {
  const [pools, names] = await Promise.all([currentPools(), namesLookup()]);
  return pools.flatMap((pool) => {
    const ledger = poolLedger(pool);
    const figures = ledger && poolFigures(ledger);
    if (!figures) return [];
    return {
      ...figures,
      id: `${pool.hotelId}/${pool.roomTypeId}`,
      hotelId: pool.hotelId,
      roomTypeId: pool.roomTypeId,
      hotelName: names.hotelName(pool.hotelId),
      roomTypeName: names.roomTypeName(pool.roomTypeId),
    };
  });
}

export const ledgerApi = {
  list: async (params: PoolListParams) => {
    const all = await poolSummaries();
    const inHotel = params.hotelId ? all.filter((pool) => pool.hotelId === params.hotelId) : all;
    return pageOf(
      params.status === 'all' ? inHotel : inHotel.filter((pool) => pool.state === params.status),
      params,
      {
        searchText: (pool) => `${pool.hotelName} ${pool.roomTypeName}`,
        sortValue: {
          state: (pool) => pool.lowestAvailable,
          hotel: (pool) => pool.hotelName,
          roomType: (pool) => pool.roomTypeName,
        },
      },
    );
  },

  overbookedCount: async () => {
    const all = await poolSummaries();
    return all.filter((pool) => pool.state === 'overbooked').length;
  },

  pool: async (hotelId: string, roomTypeId: string): Promise<PoolDetail> => {
    const [pools, names] = await Promise.all([currentPools(), namesLookup()]);
    const pool = pools.find((item) => item.hotelId === hotelId && item.roomTypeId === roomTypeId) ?? {
      hotelId,
      roomTypeId,
      purchases: [],
      sales: [],
    };
    const ledger = poolLedger(pool);
    return {
      hotelId,
      roomTypeId,
      hotelName: names.hotelName(hotelId),
      roomTypeName: names.roomTypeName(roomTypeId),
      pool,
      ledger,
      figures: ledger && poolFigures(ledger),
    };
  },

  addSampleSale: (input: SampleSaleInput) => {
    const id = crypto.randomUUID();
    return mockDb.put('sampleSales', { ...input, id, reference: `SAMPLE-${id.slice(0, 4).toUpperCase()}` });
  },

  removeSampleSale: (id: string) => mockDb.remove('sampleSales', id),
};
