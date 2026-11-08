/**
 * The reports, added up from the night facts. Rounded once, per row shown; a total is the
 * sum of its rounded rows, so every report foots.
 */

import type Decimal from 'decimal.js';

import { dayNumber, isoDate, nightsBetween } from '@/lib/format/dates';
import { dec, roundTo } from '@/lib/money/money';

import type { Convert, Money } from './currency';
import type { LineNight, NightFacts, PoolNight, PurchaseRecord, SaleRecord } from './night-facts';

/** A stay range [from, to). An empty bound means open-ended. */
export interface Range {
  from: string;
  to: string;
}

export const inRange = (day: number, { from, to }: Range) =>
  (from === '' || day >= dayNumber(from)) && (to === '' || day < dayNumber(to));

export const dateInRange = (iso: string, { from, to }: Range) =>
  (from === '' || iso >= from) && (to === '' || iso < to);

/** What a set of line-nights earned. Strings, rounded to the report currency. */
export interface Totals {
  roomNights: string;
  revenueRoom: string;
  revenueMeal: string;
  costRoom: string;
  costMeal: string;
  roomMargin: string;
  mealMargin: string;
  /** Profit on rooms with a purchase behind them. */
  profitKnown: string;
  unknownRoomNights: string;
  unknownRevenue: string;
  mealMissingRoomNights: string;
}

const ZERO = dec(0);

function addUp(lines: readonly LineNight[], decimals: number): Totals {
  let roomNights = ZERO;
  let revenueRoom = ZERO;
  let revenueMeal = ZERO;
  let costRoom = ZERO;
  let costMeal = ZERO;
  let unknownRoomNights = ZERO;
  let unknownRevenue = ZERO;
  let mealMissing = ZERO;
  for (const line of lines) {
    roomNights = roomNights.plus(line.sale.rooms);
    revenueRoom = revenueRoom.plus(line.knownRevenueRoom);
    revenueMeal = revenueMeal.plus(line.knownRevenueMeal);
    costRoom = costRoom.plus(line.costRoom);
    costMeal = costMeal.plus(line.costMeal);
    unknownRoomNights = unknownRoomNights.plus(line.unknownRooms);
    unknownRevenue = unknownRevenue.plus(line.unknownRevenue);
    if (line.mealMissing) mealMissing = mealMissing.plus(line.sale.rooms);
  }
  const money = (value: Decimal) => roundTo(value, decimals);
  const rooms = (value: Decimal) => roundTo(value, 2).replace(/\.?0+$/, '');
  const roomMargin = money(revenueRoom.minus(costRoom));
  const mealMargin = money(revenueMeal.minus(costMeal));
  return {
    roomNights: rooms(roomNights),
    revenueRoom: money(revenueRoom),
    revenueMeal: money(revenueMeal),
    costRoom: money(costRoom),
    costMeal: money(costMeal),
    roomMargin,
    mealMargin,
    profitKnown: roundTo(dec(roomMargin).plus(mealMargin), decimals),
    unknownRoomNights: rooms(unknownRoomNights),
    unknownRevenue: money(unknownRevenue),
    mealMissingRoomNights: rooms(mealMissing),
  };
}

const TOTAL_FIELDS = [
  'roomNights',
  'revenueRoom',
  'revenueMeal',
  'costRoom',
  'costMeal',
  'roomMargin',
  'mealMargin',
  'profitKnown',
  'unknownRoomNights',
  'unknownRevenue',
  'mealMissingRoomNights',
] as const satisfies readonly (keyof Totals)[];

const ROOM_FIELDS = new Set<keyof Totals>(['roomNights', 'unknownRoomNights', 'mealMissingRoomNights']);

/** Room counts can be fractions of a room where a night is shared pro rata. */
const roomCount = (value: Decimal) => roundTo(value, 2).replace(/.?0+$/, '');

/** Adds rounded rows, so the total equals what the rows show. */
export function sumTotals(rows: readonly Totals[], decimals: number): Totals {
  const result = {} as Totals;
  for (const field of TOTAL_FIELDS) {
    const total = rows.reduce((sum, row) => sum.plus(row[field]), ZERO);
    result[field] = ROOM_FIELDS.has(field) ? roomCount(total) : roundTo(total, decimals);
  }
  return result;
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const id = keyOf(item);
    const group = groups.get(id);
    if (group) group.push(item);
    else groups.set(id, [item]);
  }
  return groups;
}

export interface Adjustment {
  kind: 'penalty' | 'refund';
  effectiveDate: string;
  purchaseId: string;
  amount: Money;
}

export interface ProfitAndLoss {
  byHotel: (Totals & { hotelId: string })[];
  byPool: (Totals & { hotelId: string; roomTypeId: string })[];
  total: Totals;
  /** Penalties paid less refunds received, dated in the period. Never in per-night averages. */
  adjustments: string;
  exposure: string;
  isPartial: boolean;
}

/** Stay-date P&L: revenue and cost matched on the same night. */
export function profitAndLoss(
  facts: NightFacts,
  adjustments: readonly Adjustment[],
  range: Range,
  hotelId: string,
  convert: Convert,
  decimals: number,
): ProfitAndLoss {
  const wanted = (item: { day: number }, itemHotel: string) =>
    inRange(item.day, range) && (hotelId === '' || itemHotel === hotelId);
  const lines = facts.lines.filter((line) => wanted(line, line.sale.hotelId));

  const byPool = [...groupBy(lines, (line) => `${line.sale.hotelId}/${line.sale.sourceTypeId}`).values()].map(
    (group) => ({
      hotelId: group[0]?.sale.hotelId ?? '',
      roomTypeId: group[0]?.sale.sourceTypeId ?? '',
      ...addUp(group, decimals),
    }),
  );
  const byHotel = [...groupBy(byPool, (row) => row.hotelId).entries()].map(([id, rows]) => ({
    hotelId: id,
    ...sumTotals(rows, decimals),
  }));
  const total = sumTotals(byHotel, decimals);
  const exposure = facts.pools
    .filter((pool) => wanted(pool, pool.hotelId))
    .reduce((sum, pool) => sum.plus(pool.exposure), ZERO);
  const net = adjustments
    .filter((adjustment) => dateInRange(adjustment.effectiveDate, range))
    .reduce((sum, adjustment) => {
      const value = convert(adjustment.amount);
      return adjustment.kind === 'refund' ? sum.plus(value) : sum.minus(value);
    }, ZERO);

  return {
    byHotel,
    byPool,
    total,
    adjustments: roundTo(net, decimals),
    exposure: roundTo(exposure, decimals),
    isPartial: dec(total.unknownRoomNights).greaterThan(0),
  };
}

export type ContractProfit = Totals & {
  contractId: string;
  number: string;
  date: string;
  agentId: string;
};

/** How contracts signed in the period did, over all their nights. */
export function contractProfit(facts: NightFacts, range: Range, decimals: number): ContractProfit[] {
  const lines = facts.lines.filter((line) => dateInRange(line.sale.date, range));
  return [...groupBy(lines, (line) => line.sale.contractId).values()].map((group) => {
    const { sale } = group[0] ?? { sale: null };
    return {
      contractId: sale?.contractId ?? '',
      number: sale?.number ?? '',
      date: sale?.date ?? '',
      agentId: sale?.agentId ?? '',
      ...addUp(group, decimals),
    };
  });
}

export interface VendorMargin {
  vendorId: string | null;
  roomNights: string;
  revenue: string;
  cost: string | null;
  margin: string | null;
}

/**
 * Vendors compared at their actual rates, through each sale's allocations. Rooms with no
 * vendor appear as one row with no cost. The main P&L never uses these rates.
 */
export function vendorMargin(
  facts: NightFacts,
  purchases: readonly PurchaseRecord[],
  range: Range,
  convert: Convert,
  decimals: number,
): VendorMargin[] {
  const byId = new Map(purchases.map((purchase) => [purchase.id, purchase]));
  const totals = new Map<string, { roomNights: Decimal; revenue: Decimal; cost: Decimal }>();
  const add = (vendorId: string, roomNights: Decimal, revenue: Decimal, cost: Decimal) => {
    const row = totals.get(vendorId) ?? { roomNights: ZERO, revenue: ZERO, cost: ZERO };
    totals.set(vendorId, {
      roomNights: row.roomNights.plus(roomNights),
      revenue: row.revenue.plus(revenue),
      cost: row.cost.plus(cost),
    });
  };

  for (const line of facts.lines) {
    if (!inRange(line.day, range)) continue;
    const { sale } = line;
    const revenuePerRoom = line.revenueRoom.plus(line.revenueMeal).dividedBy(sale.rooms);
    let allocated = 0;
    for (const allocation of sale.allocations) {
      if (line.day < dayNumber(allocation.checkIn) || line.day >= dayNumber(allocation.checkOut)) continue;
      const purchase = byId.get(allocation.purchaseId);
      const purchaseLine = purchase?.lines.find((item) => item.roomTypeId === sale.sourceTypeId);
      if (!purchase || !purchaseLine) continue;
      allocated += allocation.rooms;
      const actual = convert(purchaseLine.cost).dividedBy(purchaseLine.rooms * purchase.boughtNights);
      add(
        purchase.vendorId,
        dec(allocation.rooms),
        revenuePerRoom.times(allocation.rooms),
        actual.times(allocation.rooms),
      );
    }
    const unallocated = sale.rooms - allocated;
    if (unallocated > 0) add('', dec(unallocated), revenuePerRoom.times(unallocated), ZERO);
  }

  return [...totals.entries()].map(([vendorId, row]) => {
    const revenue = roundTo(row.revenue, decimals);
    const cost = vendorId === '' ? null : roundTo(row.cost, decimals);
    return {
      vendorId: vendorId === '' ? null : vendorId,
      roomNights: roundTo(row.roomNights, 2).replace(/\.?0+$/, ''),
      revenue,
      cost,
      margin: cost === null ? null : roundTo(dec(revenue).minus(cost), decimals),
    };
  });
}

export interface InventoryRow {
  hotelId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  purchased: number;
  sold: number;
  unsold: number;
  overbooked: number;
  exposure: string;
}

/** Sold and unsold rooms per pool, joining neighbouring nights with the same figures. */
export function inventoryRows(
  pools: readonly PoolNight[],
  range: Range,
  hotelId: string,
  decimals: number,
): InventoryRow[] {
  const wanted = pools
    .filter((pool) => inRange(pool.day, range) && (hotelId === '' || pool.hotelId === hotelId))
    .sort(
      (a, b) =>
        a.hotelId.localeCompare(b.hotelId) || a.roomTypeId.localeCompare(b.roomTypeId) || a.day - b.day,
    );
  const rows: (Omit<InventoryRow, 'exposure'> & { exposure: Decimal; lastDay: number })[] = [];
  for (const pool of wanted) {
    const overbooked = Math.max(pool.sold - pool.purchased, 0);
    const last = rows.at(-1);
    const continues =
      last?.hotelId === pool.hotelId &&
      last.roomTypeId === pool.roomTypeId &&
      last.lastDay + 1 === pool.day &&
      last.purchased === pool.purchased &&
      last.sold === pool.sold;
    if (last && continues) {
      last.lastDay = pool.day;
      last.checkOut = isoDate(pool.day + 1);
      last.exposure = last.exposure.plus(pool.exposure);
    } else {
      rows.push({
        hotelId: pool.hotelId,
        roomTypeId: pool.roomTypeId,
        checkIn: isoDate(pool.day),
        checkOut: isoDate(pool.day + 1),
        lastDay: pool.day,
        purchased: pool.purchased,
        sold: pool.sold,
        unsold: pool.unsoldRooms,
        overbooked,
        exposure: pool.exposure,
      });
    }
  }
  return rows.map((row) => ({
    hotelId: row.hotelId,
    roomTypeId: row.roomTypeId,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    purchased: row.purchased,
    sold: row.sold,
    unsold: row.unsold,
    overbooked: row.overbooked,
    exposure: roundTo(row.exposure, decimals),
  }));
}

export const SALES_GROUPS = ['date', 'agent', 'hotel', 'vendor'] as const;
export type SalesGroup = (typeof SALES_GROUPS)[number];

export interface SalesRow {
  group: string;
  contracts: number;
  hotels: number;
  rooms: number;
  roomNights: string;
  amount: string;
}

/**
 * What was sold, by contract date. Grouped by vendor, a line's amount is shared by its
 * allocated room-nights; the part with no vendor is its own group.
 */
export function salesRows(
  sales: readonly SaleRecord[],
  purchases: readonly Pick<PurchaseRecord, 'id' | 'vendorId'>[],
  groupKey: SalesGroup,
  convert: Convert,
  decimals: number,
): SalesRow[] {
  const vendorOf = new Map(purchases.map((purchase) => [purchase.id, purchase.vendorId]));
  interface Piece {
    group: string;
    sale: SaleRecord;
    roomNights: Decimal;
    amount: Decimal;
  }
  const pieces: Piece[] = sales.flatMap((sale): Piece[] => {
    const amount = convert(sale.roomAmount).plus(convert(sale.mealIncome));
    const roomNights = dec(sale.rooms).times(nightsBetween(sale.checkIn, sale.checkOut));
    if (groupKey !== 'vendor') {
      const group = groupKey === 'date' ? sale.date : groupKey === 'agent' ? sale.agentId : sale.hotelId;
      return [{ group, sale, roomNights, amount }];
    }
    const perVendor = new Map<string, number>();
    for (const allocation of sale.allocations) {
      const vendorId = vendorOf.get(allocation.purchaseId) ?? '';
      const nights = nightsBetween(allocation.checkIn, allocation.checkOut) * allocation.rooms;
      perVendor.set(vendorId, (perVendor.get(vendorId) ?? 0) + nights);
    }
    const allocated = [...perVendor.values()].reduce((total, value) => total + value, 0);
    const rest = roomNights.minus(allocated);
    if (rest.greaterThan(0)) perVendor.set('', (perVendor.get('') ?? 0) + rest.toNumber());
    return [...perVendor.entries()].map(([vendorId, nights]) => ({
      group: vendorId,
      sale,
      roomNights: dec(nights),
      amount: roomNights.isZero() ? ZERO : amount.times(nights).dividedBy(roomNights),
    }));
  });

  return [...groupBy(pieces, (piece) => piece.group).entries()]
    .map(([group, items]) => ({
      group,
      contracts: new Set(items.map((item) => item.sale.contractId)).size,
      hotels: new Set(items.map((item) => item.sale.hotelId)).size,
      rooms: [...new Map(items.map((item) => [item.sale.id, item.sale.rooms])).values()].reduce(
        (total, rooms) => total + rooms,
        0,
      ),
      roomNights: roundTo(
        items.reduce((total, item) => total.plus(item.roomNights), ZERO),
        2,
      ).replace(/\.?0+$/, ''),
      amount: roundTo(
        items.reduce((total, item) => total.plus(item.amount), ZERO),
        decimals,
      ),
    }))
    .sort((a, b) => a.group.localeCompare(b.group));
}
