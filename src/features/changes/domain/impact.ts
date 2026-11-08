/**
 * What a change does to the ledger, before it is saved: the same engine run on the records
 * now and on the records after, night by night. Reads the night grid, never the Result.
 */

import {
  buildPools,
  poolLedger,
  unallocatedBlocks,
  type LedgerSale,
  type PoolPurchaseInput,
  type PoolSaleInput,
} from '@/features/inventory';
import { dayNumber, isoDate } from '@/lib/format/dates';

export interface Figures {
  purchased: number;
  sold: number;
  available: number;
}

export interface ImpactRow {
  /** Night indexes: [from, to). */
  from: number;
  to: number;
  before: Figures;
  after: Figures;
}

export interface PoolImpact {
  hotelId: string;
  roomTypeId: string;
  rows: ImpactRow[];
}

export interface LostCover {
  saleId: string;
  contractId: string;
  reference: string;
  hotelId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
}

export interface Impact {
  pools: PoolImpact[];
  /** Rooms that had a vendor and no longer do, per sale line and block of nights. */
  lostCover: LostCover[];
  /** True when any night is short after the change, and more short than before. */
  worsens: boolean;
}

export interface RecordSet {
  purchases: readonly PoolPurchaseInput[];
  sales: readonly PoolSaleInput[];
}

const ZERO: Figures = { purchased: 0, sold: 0, available: 0 };
const same = (a: Figures, b: Figures) =>
  a.purchased === b.purchased && a.sold === b.sold && a.available === b.available;

function perNight(records: RecordSet): Map<string, Map<number, Figures>> {
  const result = new Map<string, Map<number, Figures>>();
  for (const pool of buildPools(records.purchases, records.sales)) {
    const nights = new Map<number, Figures>();
    for (const row of poolLedger(pool)?.nights ?? []) {
      for (let day = row.from; day < row.to; day++) {
        nights.set(day, { purchased: row.purchased, sold: row.sold, available: row.available });
      }
    }
    result.set(`${pool.hotelId}/${pool.roomTypeId}`, nights);
  }
  return result;
}

function unallocatedPerNight(sale: LedgerSale): Map<number, number> {
  const nights = new Map<number, number>();
  for (const block of unallocatedBlocks(sale, sale.rooms, sale.allocations)) {
    for (let day = dayNumber(block.checkIn); day < dayNumber(block.checkOut); day++) {
      nights.set(day, block.rooms);
    }
  }
  return nights;
}

/**
 * Rooms that lose their vendor. Sale lines are matched by their key, so lines of a contract
 * that is itself being edited should be left out by the caller.
 */
export function lostCover(before: readonly LedgerSale[], after: readonly LedgerSale[]): LostCover[] {
  const lost: LostCover[] = [];
  for (const sale of after) {
    const previous = before.find((item) => item.id === sale.id);
    if (!previous) continue;
    const was = unallocatedPerNight(previous);
    const now = unallocatedPerNight(sale);
    let open: LostCover | null = null;
    for (let day = dayNumber(sale.checkIn); day <= dayNumber(sale.checkOut); day++) {
      const rooms = day < dayNumber(sale.checkOut) ? (now.get(day) ?? 0) - (was.get(day) ?? 0) : 0;
      if (open && (rooms !== open.rooms || rooms <= 0)) {
        lost.push(open);
        open = null;
      }
      if (!open && rooms > 0) {
        open = {
          saleId: sale.id,
          contractId: sale.contractId,
          reference: sale.reference,
          hotelId: sale.hotelId,
          roomTypeId: sale.roomTypeId,
          checkIn: isoDate(day),
          checkOut: isoDate(day + 1),
          rooms,
        };
      } else if (open) {
        open.checkOut = isoDate(day + 1);
      }
    }
  }
  return lost;
}

export function impactOf(
  before: RecordSet,
  after: RecordSet,
  covers: { before: readonly LedgerSale[]; after: readonly LedgerSale[] } = { before: [], after: [] },
): Impact {
  const was = perNight(before);
  const now = perNight(after);
  const pools: PoolImpact[] = [];
  let worsens = false;

  for (const key of new Set([...was.keys(), ...now.keys()])) {
    const [hotelId = '', roomTypeId = ''] = key.split('/');
    const beforeNights = was.get(key) ?? new Map<number, Figures>();
    const afterNights = now.get(key) ?? new Map<number, Figures>();
    const days = [...new Set([...beforeNights.keys(), ...afterNights.keys()])].sort((a, b) => a - b);
    const rows: ImpactRow[] = [];
    for (const day of days) {
      const b = beforeNights.get(day) ?? ZERO;
      const a = afterNights.get(day) ?? ZERO;
      if (same(a, b)) continue;
      if (a.available < 0 && a.available < b.available) worsens = true;
      const last = rows.at(-1);
      if (last?.to === day && same(last.before, b) && same(last.after, a)) last.to = day + 1;
      else rows.push({ from: day, to: day + 1, before: b, after: a });
    }
    if (rows.length > 0) pools.push({ hotelId, roomTypeId, rows });
  }
  return { pools, lostCover: lostCover(covers.before, covers.after), worsens };
}
