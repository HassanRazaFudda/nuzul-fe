/**
 * What a contract would do to the ledger, and the tags a Confirmed one carries. Everything
 * reads the night grid, never the Result table. Overbooking warns; it never blocks.
 */

import {
  buildPools,
  poolLedger,
  type LedgerOutput,
  type Pool,
  type PoolPurchaseInput,
  type PoolSaleInput,
} from '@/features/inventory';
import { isConversionAllowed, type ConversionRule, type RoomType } from '@/features/room-types';
import { dayNumber } from '@/lib/format/dates';

import { freeOnNight, unallocatedBlocks, type Allocation, type Supply, type TakenRooms } from './allocation';

export interface DraftLine {
  hotelId: string;
  soldAsTypeId: string;
  sourceTypeId: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
}

export interface Shortage {
  hotelId: string;
  roomTypeId: string;
  /** Night indexes: [from, to). */
  from: number;
  to: number;
  rooms: number;
}

export interface SourceSuggestion {
  hotelId: string;
  soldAsTypeId: string;
  sourceTypeId: string;
  free: number;
}

export interface OverbookingPreview {
  shortages: Shortage[];
  suggestions: SourceSuggestion[];
}

export interface PreviewContext {
  purchases: readonly PoolPurchaseInput[];
  /** Other Confirmed sales. Never the contract being previewed. */
  sales: readonly PoolSaleInput[];
  rules: ConversionRule[];
  roomTypes: RoomType[];
}

const toSale = (line: DraftLine, index: number): PoolSaleInput => ({
  id: `draft-${String(index)}`,
  contractId: '',
  reference: 'This contract',
  hotelId: line.hotelId,
  roomTypeId: line.sourceTypeId,
  checkIn: line.checkIn,
  checkOut: line.checkOut,
  rooms: line.rooms,
});

const ledgerOf = (pools: Pool[], hotelId: string, roomTypeId: string): LedgerOutput | null => {
  const pool = pools.find((item) => item.hotelId === hotelId && item.roomTypeId === roomTypeId);
  return pool ? poolLedger(pool) : null;
};

/** The shortages these lines would leave, and any allowed source that could cover them. */
export function overbookingPreview(lines: readonly DraftLine[], context: PreviewContext): OverbookingPreview {
  const pools = buildPools(context.purchases, [...context.sales, ...lines.map(toSale)]);
  const shortages: Shortage[] = [];
  const suggestions: SourceSuggestion[] = [];

  const touched = new Set(lines.map((line) => `${line.hotelId}/${line.sourceTypeId}`));
  for (const key of touched) {
    const [hotelId = '', roomTypeId = ''] = key.split('/');
    const inPool = lines.filter((line) => line.hotelId === hotelId && line.sourceTypeId === roomTypeId);
    const short = (ledgerOf(pools, hotelId, roomTypeId)?.nights ?? []).filter(
      (night) =>
        night.available < 0 &&
        inPool.some((line) => night.from < dayNumber(line.checkOut) && night.to > dayNumber(line.checkIn)),
    );
    for (const night of short) {
      shortages.push({ hotelId, roomTypeId, from: night.from, to: night.to, rooms: -night.available });
    }
    if (short.length === 0) continue;

    const needed = Math.max(...short.map((night) => -night.available));
    for (const soldAsTypeId of new Set(inPool.map((line) => line.soldAsTypeId))) {
      for (const type of context.roomTypes) {
        if (type.id === roomTypeId) continue;
        if (!isConversionAllowed(context.rules, context.roomTypes, hotelId, type.id, soldAsTypeId)) continue;
        const nights = ledgerOf(pools, hotelId, type.id)?.nights ?? [];
        const free = Math.min(
          ...short.map((shortNight) => {
            const covering = nights.filter(
              (night) => night.from < shortNight.to && night.to > shortNight.from,
            );
            const coversAll =
              covering.reduce((total, night) => total + (night.to - night.from), 0) >=
              shortNight.to - shortNight.from;
            return coversAll ? Math.min(...covering.map((night) => night.available)) : 0;
          }),
        );
        if (free >= needed) suggestions.push({ hotelId, soldAsTypeId, sourceTypeId: type.id, free });
      }
    }
  }
  return { shortages, suggestions };
}

export interface LineTags {
  overbooked: boolean;
  needsVendor: boolean;
}

interface TagLine {
  hotelId: string;
  sourceTypeId: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  allocations: readonly Allocation[];
}

/**
 * OVERBOOKED: the pool itself is short on the line's nights. Needs vendor: rooms with no
 * vendor, while a purchase has free rooms on those nights. Worked out on every read, so
 * tags clear themselves when a purchase is added.
 */
export function lineTags(
  line: TagLine,
  ledger: LedgerOutput | null,
  supplies: readonly Supply[],
  taken: readonly TakenRooms[],
): LineTags {
  const from = dayNumber(line.checkIn);
  const to = dayNumber(line.checkOut);
  const overbooked = (ledger?.nights ?? []).some(
    (night) => night.available < 0 && night.from < to && night.to > from,
  );

  const candidates = supplies.filter(
    (supply) => supply.hotelId === line.hotelId && supply.roomTypeId === line.sourceTypeId,
  );
  const needsVendor = unallocatedBlocks(line, line.rooms, line.allocations).some((block) => {
    for (let day = dayNumber(block.checkIn); day < dayNumber(block.checkOut); day++) {
      if (candidates.some((supply) => freeOnNight(supply, day, taken) > 0)) return true;
    }
    return false;
  });

  return { overbooked, needsVendor };
}
