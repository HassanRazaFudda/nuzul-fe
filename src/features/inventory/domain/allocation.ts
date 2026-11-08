/**
 * Whose rooms a sale uses. Allocations say which purchase supplies which rooms on which
 * nights. They never change the ledger's figures, only who supplies the rooms. A range
 * [checkIn, checkOut) covers the nights from check-in up to, not including, check-out.
 */

import { dayNumber, isoDate } from '@/lib/format/dates';

/** One Confirmed purchase line a sale can draw from. */
export interface Supply {
  purchaseId: string;
  number: string;
  vendorName: string;
  hotelId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
}

export interface Allocation {
  purchaseId: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
}

/** Rooms already spoken for on a purchase, by a Confirmed sale or another line on this form. */
export type TakenRooms = Allocation & { roomTypeId: string };

export interface Stay {
  checkIn: string;
  checkOut: string;
}

const covers = (range: Stay, day: number) =>
  day >= dayNumber(range.checkIn) && day < dayNumber(range.checkOut);

export function freeOnNight(supply: Supply, day: number, taken: readonly TakenRooms[]): number {
  if (!covers(supply, day)) return 0;
  const used = taken
    .filter(
      (item) =>
        item.purchaseId === supply.purchaseId && item.roomTypeId === supply.roomTypeId && covers(item, day),
    )
    .reduce((total, item) => total + item.rooms, 0);
  return Math.max(supply.rooms - used, 0);
}

/** The fewest free rooms on any night a stay shares with the purchase. */
export function fewestFree(supply: Supply, stay: Stay, taken: readonly TakenRooms[]): number {
  const from = Math.max(dayNumber(stay.checkIn), dayNumber(supply.checkIn));
  const to = Math.min(dayNumber(stay.checkOut), dayNumber(supply.checkOut));
  if (from >= to) return 0;
  let fewest = Number.POSITIVE_INFINITY;
  for (let day = from; day < to; day++) fewest = Math.min(fewest, freeOnNight(supply, day, taken));
  return fewest;
}

/** Night-by-night room counts into blocks, joining neighbouring nights with the same count. */
function toBlocks(perNight: Map<number, number>): (Stay & { rooms: number })[] {
  const blocks: (Stay & { rooms: number })[] = [];
  const days = [...perNight.keys()].sort((a, b) => a - b);
  for (const day of days) {
    const rooms = perNight.get(day) ?? 0;
    if (rooms <= 0) continue;
    const last = blocks.at(-1);
    if (last?.checkOut === isoDate(day) && last.rooms === rooms) last.checkOut = isoDate(day + 1);
    else blocks.push({ checkIn: isoDate(day), checkOut: isoDate(day + 1), rooms });
  }
  return blocks;
}

function oldestFirst(a: Supply, b: Supply) {
  return a.number.localeCompare(b.number);
}

interface SuggestLine extends Stay {
  hotelId: string;
  roomTypeId: string;
  rooms: number;
}

/** Fills a line night by night from purchases with free rooms, oldest purchase first. */
export function suggestAllocation(
  line: SuggestLine,
  supplies: readonly Supply[],
  taken: readonly TakenRooms[],
): Allocation[] {
  const candidates = supplies
    .filter((supply) => supply.hotelId === line.hotelId && supply.roomTypeId === line.roomTypeId)
    .sort(oldestFirst);
  const perSupply = new Map(candidates.map((supply) => [supply.purchaseId, new Map<number, number>()]));

  for (let day = dayNumber(line.checkIn); day < dayNumber(line.checkOut); day++) {
    let remaining = line.rooms;
    for (const supply of candidates) {
      if (remaining === 0) break;
      const use = Math.min(freeOnNight(supply, day, taken), remaining);
      perSupply.get(supply.purchaseId)?.set(day, use);
      remaining -= use;
    }
  }

  return candidates.flatMap((supply) =>
    toBlocks(perSupply.get(supply.purchaseId) ?? new Map<number, number>()).map((block) => ({
      purchaseId: supply.purchaseId,
      ...block,
    })),
  );
}

/** The rooms on a line that no purchase supplies, as blocks of nights. */
export function unallocatedBlocks(
  stay: Stay,
  rooms: number,
  allocations: readonly Allocation[],
): (Stay & { rooms: number })[] {
  const perNight = new Map<number, number>();
  for (let day = dayNumber(stay.checkIn); day < dayNumber(stay.checkOut); day++) {
    const supplied = allocations
      .filter((allocation) => covers(allocation, day))
      .reduce((total, allocation) => total + allocation.rooms, 0);
    perNight.set(day, rooms - supplied);
  }
  return toBlocks(perNight);
}

/**
 * Cuts allocations back to what is free now. Free rooms can go between saving and
 * confirming; the excess becomes Unallocated, and the sale still goes through.
 */
export function trimToFree(
  allocations: readonly Allocation[],
  roomTypeId: string,
  supplies: readonly Supply[],
  taken: readonly TakenRooms[],
): { allocations: Allocation[]; trimmedRooms: number } {
  const running: TakenRooms[] = [...taken];
  const kept: Allocation[] = [];
  let trimmedRooms = 0;

  for (const allocation of allocations) {
    const supply = supplies.find(
      (item) => item.purchaseId === allocation.purchaseId && item.roomTypeId === roomTypeId,
    );
    const perNight = new Map<number, number>();
    for (let day = dayNumber(allocation.checkIn); day < dayNumber(allocation.checkOut); day++) {
      const free = supply ? freeOnNight(supply, day, running) : 0;
      const use = Math.min(free, allocation.rooms);
      perNight.set(day, use);
      trimmedRooms = Math.max(trimmedRooms, allocation.rooms - use);
    }
    for (const block of toBlocks(perNight)) {
      const part = { purchaseId: allocation.purchaseId, ...block };
      kept.push(part);
      running.push({ ...part, roomTypeId });
    }
  }
  return { allocations: kept, trimmedRooms };
}

export type AllocationField = 'purchaseId' | 'checkIn' | 'checkOut' | 'rooms';

export interface AllocationProblem {
  index: number;
  field: AllocationField;
  message: string;
}

/** What is wrong with a line's allocations, field by field. An empty list means they fit. */
export function allocationProblems(
  line: SuggestLine,
  allocations: readonly Allocation[],
  supplies: readonly Supply[],
  taken: readonly TakenRooms[],
): AllocationProblem[] {
  const problems: AllocationProblem[] = [];
  allocations.forEach((allocation, index) => {
    const supply = supplies.find(
      (item) =>
        item.purchaseId === allocation.purchaseId &&
        item.hotelId === line.hotelId &&
        item.roomTypeId === line.roomTypeId,
    );
    if (!supply) {
      problems.push({ index, field: 'purchaseId', message: 'Choose a purchase of this hotel and room type' });
      return;
    }
    if (allocation.checkOut <= allocation.checkIn) {
      problems.push({ index, field: 'checkOut', message: 'Must be after the start' });
      return;
    }
    if (allocation.checkIn < line.checkIn || allocation.checkOut > line.checkOut) {
      problems.push({ index, field: 'checkIn', message: 'Outside this stay' });
      return;
    }
    if (allocation.checkIn < supply.checkIn || allocation.checkOut > supply.checkOut) {
      problems.push({ index, field: 'checkIn', message: 'Outside this purchase' });
      return;
    }
    const earlier = allocations.slice(0, index).map((item) => ({ ...item, roomTypeId: line.roomTypeId }));
    const free = fewestFree(supply, allocation, [...taken, ...earlier]);
    if (allocation.rooms > free) {
      problems.push({ index, field: 'rooms', message: `Only ${String(free)} free on these nights` });
      return;
    }
    const others = allocations.filter((_, other) => other !== index);
    for (let day = dayNumber(allocation.checkIn); day < dayNumber(allocation.checkOut); day++) {
      const supplied = others
        .filter((item) => covers(item, day))
        .reduce((total, item) => total + item.rooms, allocation.rooms);
      if (supplied > line.rooms) {
        problems.push({ index, field: 'rooms', message: `More than the line's ${String(line.rooms)} rooms` });
        return;
      }
    }
  });
  return problems;
}
