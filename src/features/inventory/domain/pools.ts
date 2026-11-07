/**
 * Turns records into pools and pools into ledgers. A pool is one (hotel, purchased room
 * type). Nothing here is stored: every read works it out again from current records.
 */

import { dayNumber, isoDate } from '@/lib/format/dates';

import {
  computeLedger,
  nightState,
  worstShortage,
  type LedgerOutput,
  type NightState,
} from './ledger-engine';

/** A purchase as the ledger needs it. The caller passes only Confirmed ones. */
export interface PoolPurchaseInput {
  id: string;
  number: string;
  hotelId: string;
  checkIn: string;
  checkOut: string;
  lines: { roomTypeId: string; rooms: number }[];
}

export interface PoolSaleInput {
  id: string;
  contractId: string;
  reference: string;
  hotelId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
}

export interface PoolPurchaseLine {
  purchaseId: string;
  number: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
}

export interface Pool {
  hotelId: string;
  roomTypeId: string;
  purchases: PoolPurchaseLine[];
  sales: PoolSaleInput[];
}

export function buildPools(purchases: readonly PoolPurchaseInput[], sales: readonly PoolSaleInput[]): Pool[] {
  const pools = new Map<string, Pool>();
  const poolFor = (hotelId: string, roomTypeId: string) => {
    const key = `${hotelId}/${roomTypeId}`;
    let pool = pools.get(key);
    if (!pool) {
      pool = { hotelId, roomTypeId, purchases: [], sales: [] };
      pools.set(key, pool);
    }
    return pool;
  };

  for (const purchase of purchases) {
    for (const line of purchase.lines) {
      poolFor(purchase.hotelId, line.roomTypeId).purchases.push({
        purchaseId: purchase.id,
        number: purchase.number,
        checkIn: purchase.checkIn,
        checkOut: purchase.checkOut,
        rooms: line.rooms,
      });
    }
  }
  for (const sale of sales) poolFor(sale.hotelId, sale.roomTypeId).sales.push(sale);
  return [...pools.values()];
}

const toEntry = ({ checkIn, checkOut, rooms }: { checkIn: string; checkOut: string; rooms: number }) => ({
  from: dayNumber(checkIn),
  to: dayNumber(checkOut),
  rooms,
});

export function poolLedger(pool: Pool): LedgerOutput | null {
  return computeLedger({ purchases: pool.purchases.map(toEntry), sales: pool.sales.map(toEntry) });
}

export interface PoolFigures {
  firstNight: string;
  lastCheckOut: string;
  peakPurchased: number;
  peakSold: number;
  /** The lowest availability on any night. Negative means short. */
  lowestAvailable: number;
  state: NightState;
  shortage: number;
  needsBuying: boolean;
}

/** A pool in one line. Every figure reads the night grid, never the Result table. */
export function poolFigures(ledger: LedgerOutput): PoolFigures | null {
  const first = ledger.nights.at(0);
  const last = ledger.nights.at(-1);
  if (!first || !last) return null;
  const lowestAvailable = Math.min(...ledger.nights.map((night) => night.available));
  return {
    firstNight: isoDate(first.from),
    lastCheckOut: isoDate(last.to),
    peakPurchased: Math.max(...ledger.nights.map((night) => night.purchased)),
    peakSold: Math.max(...ledger.nights.map((night) => night.sold)),
    lowestAvailable,
    state: nightState(lowestAvailable),
    shortage: worstShortage(ledger),
    needsBuying: ledger.need.length > 0,
  };
}

/** True when a night is short but no Result row shows it, so the Result must not be trusted. */
export function resultHidesShortage(ledger: LedgerOutput): boolean {
  return worstShortage(ledger) > 0 && !ledger.result.some((row) => row.available < 0);
}

/** Room-nights across the grid, for the pool's summary. */
export function roomNights(ledger: LedgerOutput, field: 'purchased' | 'sold'): number {
  return ledger.nights.reduce((total, night) => total + night[field] * (night.to - night.from), 0);
}
