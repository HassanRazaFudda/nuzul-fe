/** What editing or cancelling a Confirmed contract does to the ledger. Pure. */

import { impactOf, type Impact } from '@/features/changes';
import { saleKey, type LedgerSale, type LedgerSources } from '@/features/inventory';

import type { ContractInput } from '../api/contract.schemas';

/** The contract's lines as the ledger will count them. */
export function salesOf(
  contract: { id: string; number: string; version: number },
  hotels: ContractInput['hotels'],
): LedgerSale[] {
  return hotels.flatMap((entry, hotelIndex) =>
    entry.lines.map((line, lineIndex) => ({
      id: saleKey(contract.id, hotelIndex, lineIndex),
      contractId: contract.id,
      contractVersion: contract.version,
      hotelIndex,
      lineIndex,
      reference: contract.number,
      hotelId: entry.hotelId,
      soldAsTypeId: line.soldAsTypeId,
      roomTypeId: line.sourceTypeId,
      checkIn: entry.checkIn,
      checkOut: entry.checkOut,
      rooms: line.rooms,
      allocations: line.allocations,
    })),
  );
}

/** `hotels` is the contract as it will be, or null when it is cancelled. */
export function contractImpact(
  sources: Pick<LedgerSources, 'purchases' | 'sales'>,
  contract: { id: string; number: string; version: number },
  hotels: ContractInput['hotels'] | null,
): Impact {
  const others = sources.sales.filter((sale) => sale.contractId !== contract.id);
  const after = {
    purchases: sources.purchases,
    sales: [...others, ...(hotels ? salesOf(contract, hotels) : [])],
  };
  // The contract's own lines change by design; only other sales can lose a vendor here.
  return impactOf(sources, after, { before: others, after: others });
}
