/**
 * Ending a purchase contract early. Pure, and run twice: in the browser for the preview,
 * and by the transport before saving. The purchase keeps the nights before the effective
 * date; every sale line losing rooms after it needs a decision, so nothing is removed
 * silently.
 */

import {
  suggestAllocation,
  unallocatedBlocks,
  type Allocation,
  type LedgerPurchase,
  type LedgerSale,
  type LedgerSources,
  type Stay,
  type Supply,
  type TakenRooms,
} from '@/features/inventory';
import { purchaseChange } from '@/features/purchases';

export type Decision =
  | { kind: 'resource'; sourceTypeId: string }
  | { kind: 'cancel'; reason: string }
  | { kind: 'accept'; reason: string };

export interface AffectedLine {
  sale: LedgerSale;
  /** The rooms this purchase supplied on released nights. */
  lost: (Stay & { rooms: number })[];
}

/** Every Confirmed sale line with rooms from this purchase on or after the effective date. */
export function affectedLines(
  sources: Pick<LedgerSources, 'sales'>,
  purchaseId: string,
  effectiveDate: string,
): AffectedLine[] {
  return sources.sales.flatMap((sale) => {
    const lost = sale.allocations
      .filter((allocation) => allocation.purchaseId === purchaseId && allocation.checkOut > effectiveDate)
      .map((allocation) => ({
        checkIn: allocation.checkIn > effectiveDate ? allocation.checkIn : effectiveDate,
        checkOut: allocation.checkOut,
        rooms: allocation.rooms,
      }));
    return lost.length > 0 ? [{ sale, lost }] : [];
  });
}

export interface TerminationResult {
  purchases: LedgerPurchase[];
  sales: LedgerSale[];
  /** Lines given new vendors or a new source type. */
  resourced: LedgerSale[];
  /** Lines kept as they are, short of a vendor. */
  accepted: LedgerSale[];
  cancelled: LedgerSale[];
  /** Rooms still without a vendor after the decisions, per affected line. */
  uncovered: Map<string, (Stay & { rooms: number })[]>;
}

function suppliesOf(purchases: readonly LedgerPurchase[]): Supply[] {
  return purchases.flatMap((purchase) =>
    purchase.lines.map((line) => ({
      purchaseId: purchase.id,
      number: purchase.number,
      vendorName: purchase.vendorName,
      hotelId: purchase.hotelId,
      roomTypeId: line.roomTypeId,
      checkIn: purchase.checkIn,
      checkOut: purchase.checkOut,
      rooms: line.rooms,
    })),
  );
}

const takenBy = (sales: readonly LedgerSale[]): TakenRooms[] =>
  sales.flatMap((sale) =>
    sale.allocations.map((allocation) => ({ ...allocation, roomTypeId: sale.roomTypeId })),
  );

/** A line moved to new vendors for the nights it lost, or wholly to another room type. */
function resource(
  sale: LedgerSale,
  sourceTypeId: string,
  effectiveDate: string,
  supplies: Supply[],
  taken: TakenRooms[],
): LedgerSale {
  if (sourceTypeId !== sale.roomTypeId) {
    const allocations = suggestAllocation({ ...sale, roomTypeId: sourceTypeId }, supplies, taken);
    return { ...sale, roomTypeId: sourceTypeId, allocations };
  }
  const added: Allocation[] = unallocatedBlocks(sale, sale.rooms, sale.allocations)
    .filter((block) => block.checkOut > effectiveDate)
    .flatMap((block) =>
      suggestAllocation(
        {
          hotelId: sale.hotelId,
          roomTypeId: sale.roomTypeId,
          checkIn: block.checkIn > effectiveDate ? block.checkIn : effectiveDate,
          checkOut: block.checkOut,
          rooms: block.rooms,
        },
        supplies,
        taken,
      ),
    );
  return { ...sale, allocations: [...sale.allocations, ...added] };
}

/**
 * The records after the termination. A line with no decision yet counts as accepted, which
 * is the worst case, so the preview never looks better than the result can be.
 */
export function applyTermination(
  sources: Pick<LedgerSources, 'purchases' | 'sales'>,
  purchase: LedgerPurchase,
  effectiveDate: string,
  decisions: Readonly<Record<string, Decision | undefined>>,
): TerminationResult {
  const clipped = { ...purchase, checkOut: effectiveDate };
  const base = purchaseChange(sources, purchase.id, clipped);
  const affected = new Set(affectedLines(sources, purchase.id, effectiveDate).map((line) => line.sale.id));
  const supplies = suppliesOf(base.purchases);

  const resourced: LedgerSale[] = [];
  const accepted: LedgerSale[] = [];
  const cancelled: LedgerSale[] = [];
  const kept = base.sales.filter((sale) => {
    if (!affected.has(sale.id)) return true;
    if (decisions[sale.id]?.kind === 'cancel') {
      cancelled.push(sale);
      return false;
    }
    return true;
  });

  const sales = kept.map((sale) => {
    if (!affected.has(sale.id)) return sale;
    const decision = decisions[sale.id];
    if (decision?.kind !== 'resource') {
      accepted.push(sale);
      return sale;
    }
    const taken = takenBy(kept.filter((other) => other.id !== sale.id)).concat(takenBy(resourced));
    const moved = resource(sale, decision.sourceTypeId, effectiveDate, supplies, taken);
    resourced.push(moved);
    return moved;
  });

  const uncovered = new Map<string, (Stay & { rooms: number })[]>();
  for (const sale of [...resourced, ...accepted]) {
    uncovered.set(sale.id, unallocatedBlocks(sale, sale.rooms, sale.allocations));
  }
  return { purchases: base.purchases, sales, resourced, accepted, cancelled, uncovered };
}
