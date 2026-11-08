/**
 * What changing, cancelling or cutting short a Confirmed purchase leaves behind. Pure, and
 * run twice: in the browser for the preview, and by the transport before saving.
 *
 * Stored allocations are never moved to another vendor. The part a purchase no longer
 * supplies becomes Unallocated, so the sale shows Needs vendor or OVERBOOKED.
 */

import {
  trimToFree,
  type Allocation,
  type LedgerPurchase,
  type LedgerSale,
  type LedgerSources,
  type Supply,
  type TakenRooms,
} from '@/features/inventory';
import { impactOf, type Impact } from '@/features/changes';

export interface PurchaseChange {
  purchases: LedgerPurchase[];
  sales: LedgerSale[];
  /** The sale lines whose allocations changed, as they are after the change. */
  changedSales: LedgerSale[];
}

const supplyOf = (purchase: LedgerPurchase, roomTypeId: string): Supply[] => {
  const line = purchase.lines.find((item) => item.roomTypeId === roomTypeId);
  return line
    ? [
        {
          purchaseId: purchase.id,
          number: purchase.number,
          vendorName: purchase.vendorName,
          hotelId: purchase.hotelId,
          roomTypeId,
          checkIn: purchase.checkIn,
          checkOut: purchase.checkOut,
          rooms: line.rooms,
        },
      ]
    : [];
};

const sameAllocations = (a: readonly Allocation[], b: readonly Allocation[]) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Oldest sale first, so the sale that took the rooms first keeps them. */
const bySaleOrder = (a: LedgerSale, b: LedgerSale) =>
  a.reference.localeCompare(b.reference) || a.hotelIndex - b.hotelIndex || a.lineIndex - b.lineIndex;

/** `replacement` is the purchase as it will count, or null when it stops counting at all. */
export function purchaseChange(
  sources: Pick<LedgerSources, 'purchases' | 'sales'>,
  purchaseId: string,
  replacement: LedgerPurchase | null,
): PurchaseChange {
  const purchases = [
    ...sources.purchases.filter((purchase) => purchase.id !== purchaseId),
    ...(replacement ? [replacement] : []),
  ];
  const running: TakenRooms[] = [];
  const changedSales: LedgerSale[] = [];

  const sales = [...sources.sales].sort(bySaleOrder).map((sale) => {
    const fromThis = sale.allocations.filter((allocation) => allocation.purchaseId === purchaseId);
    if (fromThis.length === 0) return sale;
    const supplies = replacement?.hotelId === sale.hotelId ? supplyOf(replacement, sale.roomTypeId) : [];
    const trimmed = trimToFree(fromThis, sale.roomTypeId, supplies, running);
    running.push(
      ...trimmed.allocations.map((allocation) => ({ ...allocation, roomTypeId: sale.roomTypeId })),
    );
    const allocations = [
      ...sale.allocations.filter((allocation) => allocation.purchaseId !== purchaseId),
      ...trimmed.allocations,
    ];
    if (sameAllocations(allocations, sale.allocations)) return sale;
    const changed = { ...sale, allocations };
    changedSales.push(changed);
    return changed;
  });

  return { purchases, sales, changedSales };
}

/** The before-and-after preview of a change to one purchase. */
export function purchaseImpact(
  sources: Pick<LedgerSources, 'purchases' | 'sales'>,
  purchaseId: string,
  replacement: LedgerPurchase | null,
): Impact {
  const change = purchaseChange(sources, purchaseId, replacement);
  return impactOf(sources, change, { before: sources.sales, after: change.sales });
}
