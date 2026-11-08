import { contractRecordSchema, type LedgerSale } from '@/features/inventory';
import { ApiError } from '@/lib/api/api-error';
import { mockDb } from '@/mock-api/db';

import type { RevisionAction } from './revision.schemas';
import { revisionsApi } from './revisions.api';

/**
 * Writes changed vendor allocations, or a new source type, back to their contracts: one new
 * version per contract, with a history entry. Totals do not change, so nothing is repriced.
 * The real server does this in the same transaction as the change that caused it.
 */
export async function saveSaleChanges(
  changed: readonly LedgerSale[],
  action: RevisionAction,
  reason: string,
): Promise<void> {
  const contractIds = [...new Set(changed.map((sale) => sale.contractId))];
  for (const contractId of contractIds) {
    const contract = await mockDb.get('contracts', contractId, contractRecordSchema);
    if (!contract) throw new ApiError({ kind: 'not_found', message: 'Contract not found' });
    const hotels = contract.hotels.map((entry, hotelIndex) => ({
      ...entry,
      lines: entry.lines.map((line, lineIndex) => {
        const sale = changed.find(
          (item) =>
            item.contractId === contractId && item.hotelIndex === hotelIndex && item.lineIndex === lineIndex,
        );
        return sale ? { ...line, sourceTypeId: sale.roomTypeId, allocations: sale.allocations } : line;
      }),
    }));
    const version = contract.version + 1;
    await mockDb.put('contracts', { ...contract, hotels, version });
    await revisionsApi.record({
      entity: 'contract',
      entityId: contractId,
      version,
      action,
      reason,
      before: contract,
      totalBefore: null,
      totalAfter: null,
    });
  }
}

/** The preview was worked out from these records; refuse if any has changed since. */
export function assertSameStamp(expected: string, actual: string) {
  if (expected !== actual) {
    throw new ApiError({
      kind: 'conflict',
      message: 'Purchases or contracts changed since the preview',
    });
  }
}
