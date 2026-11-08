/**
 * The facts every money report is built from: one row per sale line and night, and one row
 * per pool (hotel, purchased room type) and night. Pure; nothing is rounded here, so the
 * reports round once, on what they show. See docs/financial-and-pnl-rules.md.
 */

import type Decimal from 'decimal.js';

import type { Allocation } from '@/features/inventory';
import { mealCostOfLine, type Meal } from '@/features/purchases';
import { dayNumber, nightsBetween } from '@/lib/format/dates';
import { dec } from '@/lib/money/money';

import type { Convert, Money } from './currency';

/** A purchase as it counts: a Terminated one already ends at its effective date. */
export interface PurchaseRecord {
  id: string;
  number: string;
  vendorId: string;
  hotelId: string;
  checkIn: string;
  checkOut: string;
  /** Nights of the stay as bought, which its cost is spread over. */
  boughtNights: number;
  currencyCode: string;
  rateToPkr: string;
  meal: Meal;
  lines: { roomTypeId: string; rooms: number; personsPerRoom: number; cost: Money }[];
}

export interface SaleRecord {
  id: string;
  contractId: string;
  number: string;
  date: string;
  agentId: string;
  hotelId: string;
  soldAsTypeId: string;
  sourceTypeId: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  personsPerRoom: number;
  roomAmount: Money;
  mealIncome: Money;
  allocations: readonly Allocation[];
}

export interface LineNight {
  sale: SaleRecord;
  day: number;
  revenueRoom: Decimal;
  revenueMeal: Decimal;
  /** Rooms with a purchase behind them, this line's share. */
  knownRooms: Decimal;
  unknownRooms: Decimal;
  /** Revenue on rooms with a purchase behind them. */
  knownRevenueRoom: Decimal;
  knownRevenueMeal: Decimal;
  /** Revenue on overbooked rooms, whose cost is Unknown. */
  unknownRevenue: Decimal;
  costRoom: Decimal;
  costMeal: Decimal;
  /** Meal income with no meal bought on that night. */
  mealMissing: boolean;
}

export interface PoolNight {
  hotelId: string;
  roomTypeId: string;
  day: number;
  purchased: number;
  sold: number;
  /** Weighted average: total cost over rooms purchased that night. Never an average of rates. */
  averageRoomCost: Decimal;
  averageMealCost: Decimal;
  unsoldRooms: number;
  exposure: Decimal;
}

interface PoolNightTotals {
  purchased: number;
  sold: number;
  roomCost: Decimal;
  mealCost: Decimal;
  hasMealSource: boolean;
}

const ZERO = dec(0);
const key = (hotelId: string, roomTypeId: string, day: number) => `${hotelId}/${roomTypeId}/${String(day)}`;

function eachNight(checkIn: string, checkOut: string, visit: (day: number) => void) {
  for (let day = dayNumber(checkIn); day < dayNumber(checkOut); day++) visit(day);
}

/** Guests-sold meals are charged per placed guest, at the allocated vendor's rate. */
function guestsSoldPerRoomNight(purchase: PurchaseRecord, sale: SaleRecord, convert: Convert): Decimal {
  const { meal } = purchase;
  if (meal.pricing !== 'separate' || meal.chargeBasis !== 'guestsSold') return ZERO;
  const perRoom = mealCostOfLine({ rooms: 1, personsPerRoom: sale.personsPerRoom }, 1, meal.rate, meal.basis);
  // Per person per stay is charged once, so it is spread over the sale's nights.
  const perNight =
    meal.basis === 'perPersonPerStay'
      ? perRoom.dividedBy(nightsBetween(sale.checkIn, sale.checkOut))
      : perRoom;
  return convert({
    amount: perNight.toString(),
    currencyCode: purchase.currencyCode,
    rateToPkr: purchase.rateToPkr,
  });
}

export interface NightFacts {
  lines: LineNight[];
  pools: PoolNight[];
}

export function nightFacts(
  purchases: readonly PurchaseRecord[],
  sales: readonly SaleRecord[],
  convert: Convert,
): NightFacts {
  const nights = new Map<string, PoolNightTotals & { hotelId: string; roomTypeId: string; day: number }>();
  const at = (hotelId: string, roomTypeId: string, day: number) => {
    const id = key(hotelId, roomTypeId, day);
    let found = nights.get(id);
    if (!found) {
      found = {
        hotelId,
        roomTypeId,
        day,
        purchased: 0,
        sold: 0,
        roomCost: ZERO,
        mealCost: ZERO,
        hasMealSource: false,
      };
      nights.set(id, found);
    }
    return found;
  };

  for (const purchase of purchases) {
    const { meal } = purchase;
    for (const line of purchase.lines) {
      const roomCostPerNight = convert(line.cost).dividedBy(purchase.boughtNights);
      const mealCostPerNight =
        meal.pricing === 'separate' && meal.chargeBasis === 'fullCapacity'
          ? convert({
              amount: mealCostOfLine(line, purchase.boughtNights, meal.rate, meal.basis).toString(),
              currencyCode: purchase.currencyCode,
              rateToPkr: purchase.rateToPkr,
            }).dividedBy(purchase.boughtNights)
          : ZERO;
      eachNight(purchase.checkIn, purchase.checkOut, (day) => {
        const night = at(purchase.hotelId, line.roomTypeId, day);
        night.purchased += line.rooms;
        night.roomCost = night.roomCost.plus(roomCostPerNight);
        night.mealCost = night.mealCost.plus(mealCostPerNight);
        night.hasMealSource ||= meal.pricing !== 'none';
      });
    }
  }
  for (const sale of sales) {
    eachNight(sale.checkIn, sale.checkOut, (day) => {
      at(sale.hotelId, sale.sourceTypeId, day).sold += sale.rooms;
    });
  }

  const average = (total: Decimal, rooms: number) => (rooms > 0 ? total.dividedBy(rooms) : ZERO);
  const byId = new Map(purchases.map((purchase) => [purchase.id, purchase]));

  const lines: LineNight[] = [];
  for (const sale of sales) {
    const saleNights = nightsBetween(sale.checkIn, sale.checkOut);
    const roomPerNight = convert(sale.roomAmount).dividedBy(saleNights);
    const mealPerNight = convert(sale.mealIncome).dividedBy(saleNights);
    eachNight(sale.checkIn, sale.checkOut, (day) => {
      const night = at(sale.hotelId, sale.sourceTypeId, day);
      const known = Math.min(night.sold, night.purchased);
      const share = night.sold > 0 ? dec(known).dividedBy(night.sold) : ZERO;
      const knownRooms = share.times(sale.rooms);
      const guestsSoldMeal = sale.allocations
        .filter((allocation) => day >= dayNumber(allocation.checkIn) && day < dayNumber(allocation.checkOut))
        .reduce((total, allocation) => {
          const purchase = byId.get(allocation.purchaseId);
          return purchase
            ? total.plus(guestsSoldPerRoomNight(purchase, sale, convert).times(allocation.rooms))
            : total;
        }, ZERO);
      lines.push({
        sale,
        day,
        revenueRoom: roomPerNight,
        revenueMeal: mealPerNight,
        knownRooms,
        unknownRooms: dec(sale.rooms).minus(knownRooms),
        knownRevenueRoom: roomPerNight.times(share),
        knownRevenueMeal: mealPerNight.times(share),
        unknownRevenue: roomPerNight.plus(mealPerNight).times(dec(1).minus(share)),
        costRoom: knownRooms.times(average(night.roomCost, night.purchased)),
        costMeal: knownRooms.times(average(night.mealCost, night.purchased)).plus(guestsSoldMeal),
        mealMissing: mealPerNight.greaterThan(0) && !night.hasMealSource,
      });
    });
  }

  const pools: PoolNight[] = [...nights.values()].map((night) => {
    const averageRoomCost = average(night.roomCost, night.purchased);
    const averageMealCost = average(night.mealCost, night.purchased);
    const unsoldRooms = night.purchased - Math.min(night.sold, night.purchased);
    return {
      hotelId: night.hotelId,
      roomTypeId: night.roomTypeId,
      day: night.day,
      purchased: night.purchased,
      sold: night.sold,
      averageRoomCost,
      averageMealCost,
      unsoldRooms,
      exposure: averageRoomCost.plus(averageMealCost).times(unsoldRooms),
    };
  });

  return { lines, pools };
}
