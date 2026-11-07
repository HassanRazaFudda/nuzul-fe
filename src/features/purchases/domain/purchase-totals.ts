/**
 * What a purchase costs. Pure, and the same on the backend later. Rounding happens once
 * per line, to the currency's decimals, and totals add the rounded lines.
 */

import { dec, roundTo, sum } from '@/lib/money/money';

export type MealBasis = 'perPersonPerNight' | 'perRoomPerNight' | 'perPersonPerStay';
export type ChargeBasis = 'fullCapacity' | 'guestsSold';

export type Meal =
  | { pricing: 'none' }
  | { pricing: 'included' }
  | { pricing: 'separate'; rate: string; basis: MealBasis; chargeBasis: ChargeBasis };

export interface CostLine {
  rooms: number;
  rate: string;
  personsPerRoom: number;
}

export interface PurchaseCostInput {
  nights: number;
  perNight: boolean;
  lines: CostLine[];
  meal: Meal;
}

export interface PurchaseTotals {
  nights: number;
  roomNights: number;
  lineCosts: string[];
  roomCost: string;
  mealCost: string;
  /** Guests sold only: the most the meal can cost. Not a cost yet, so never in the total. */
  mealMaximum: string | null;
  total: string;
}

function fullMealCost(lines: CostLine[], nights: number, rate: string, basis: MealBasis) {
  const costs = lines.map(({ rooms, personsPerRoom }) => {
    switch (basis) {
      case 'perPersonPerNight':
        return dec(rate).times(rooms).times(personsPerRoom).times(nights);
      case 'perRoomPerNight':
        return dec(rate).times(rooms).times(nights);
      case 'perPersonPerStay':
        return dec(rate).times(rooms).times(personsPerRoom);
    }
  });
  return sum(costs);
}

export function purchaseTotals(
  { nights, perNight, lines, meal }: PurchaseCostInput,
  decimals: number,
): PurchaseTotals {
  const lineCosts = lines.map(({ rooms, rate }) =>
    roundTo(
      dec(rate)
        .times(rooms)
        .times(perNight ? nights : 1),
      decimals,
    ),
  );
  const roomCost = roundTo(sum(lineCosts), decimals);
  const fullMeal =
    meal.pricing === 'separate'
      ? roundTo(fullMealCost(lines, nights, meal.rate, meal.basis), decimals)
      : roundTo(0, decimals);
  const isGuestsSold = meal.pricing === 'separate' && meal.chargeBasis === 'guestsSold';
  const mealCost = isGuestsSold ? roundTo(0, decimals) : fullMeal;

  return {
    nights,
    roomNights: lines.reduce((total, line) => total + line.rooms * nights, 0),
    lineCosts,
    roomCost,
    mealCost,
    mealMaximum: isGuestsSold ? fullMeal : null,
    total: roundTo(sum([roomCost, mealCost]), decimals),
  };
}

/** The rates a hotel keeps for reference, in the shape pre-filling needs. */
export interface ReferenceRates {
  flatRate?: string | undefined;
  doubleRate?: string | undefined;
  extraBedRate?: string | undefined;
}

const DOUBLE_CAPACITY = 2;

/**
 * Pre-fills a line from a hotel's reference rates: Double = double rate, each guest above
 * two adds an extra bed, otherwise the flat rate. Empty when the hotel has no usable rate.
 */
export function referenceRate(hotel: ReferenceRates, capacity: number): string {
  const { flatRate, doubleRate, extraBedRate } = hotel;
  const extraBeds = capacity - DOUBLE_CAPACITY;
  if (doubleRate && extraBeds <= 0) return doubleRate;
  if (doubleRate && extraBedRate) return dec(doubleRate).plus(dec(extraBedRate).times(extraBeds)).toString();
  return flatRate ?? '';
}
