import { hotelSchema } from '@/features/hotels';
import { roomTypeSchema } from '@/features/room-types';
import { mockDb } from '@/mock-api/db';
import { assertCan } from '@/mock-api/session';
import { pageOf } from '@/mock-api/list-query';

import { buildPools, poolFigures, poolLedger, roomNights, seasonNights, type Pool } from '../domain/pools';
import { loadLedgerSources } from './ledger-sources.api';
import type { PoolDetail, PoolListParams, PoolSummary, SeasonOverview } from './ledger.schemas';

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
  const { purchases, sales } = await loadLedgerSources();
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
      roomNightsPurchased: roomNights(ledger, 'purchased'),
      roomNightsSold: roomNights(ledger, 'sold'),
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
    await assertCan('inventory.view');
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

  /** Every pool at once, short ones first, and the season's nights summed over them. */
  season: async (): Promise<SeasonOverview> => {
    await assertCan('inventory.view');
    const [all, pools] = await Promise.all([poolSummaries(), currentPools()]);
    return {
      pools: all.toSorted(
        (a, b) =>
          a.lowestAvailable - b.lowestAvailable ||
          a.hotelName.localeCompare(b.hotelName) ||
          a.roomTypeName.localeCompare(b.roomTypeName),
      ),
      nights: seasonNights(pools.flatMap((pool) => poolLedger(pool) ?? [])),
    };
  },

  overbookedCount: async () => {
    const all = await poolSummaries();
    return all.filter((pool) => pool.state === 'overbooked').length;
  },

  pool: async (hotelId: string, roomTypeId: string): Promise<PoolDetail> => {
    await assertCan('inventory.view');
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
};
