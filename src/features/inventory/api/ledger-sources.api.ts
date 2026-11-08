import { z } from 'zod';

import { partnerSchema } from '@/features/partners';
import { mockDb } from '@/mock-api/db';

import {
  countingPurchases,
  saleKey,
  type LedgerPurchase,
  type LedgerSale,
  type LedgerSources,
} from '../domain/ledger-sources';

// Only what the ledger needs from purchases and contracts: this feature depends on neither,
// as the real server reads its own tables.
const purchaseRecordSchema = z.object({
  id: z.string(),
  number: z.string(),
  version: z.number().int(),
  status: z.string(),
  hotelId: z.string(),
  vendorId: z.string(),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  lines: z.array(z.object({ roomTypeId: z.string(), rooms: z.number().int() })),
  termination: z.object({ effectiveDate: z.iso.date() }).optional(),
});

const allocationSchema = z.object({
  purchaseId: z.string(),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  rooms: z.number().int(),
});

/**
 * Loose at every level: anything that writes a contract back after reading it this way keeps
 * the fields this schema does not name.
 */
export const contractRecordSchema = z.looseObject({
  id: z.string(),
  number: z.string(),
  version: z.number().int(),
  status: z.string(),
  hotels: z.array(
    z.looseObject({
      hotelId: z.string(),
      checkIn: z.iso.date(),
      checkOut: z.iso.date(),
      lines: z.array(
        z.looseObject({
          soldAsTypeId: z.string(),
          sourceTypeId: z.string(),
          rooms: z.number().int(),
          allocations: z.array(allocationSchema),
        }),
      ),
    }),
  ),
});

/** The records the ledger is worked out from, read fresh. */
export async function loadLedgerSources(): Promise<LedgerSources> {
  const [purchaseRecords, contracts, vendors] = await Promise.all([
    mockDb.list('purchases', purchaseRecordSchema),
    mockDb.list('contracts', contractRecordSchema),
    mockDb.list('vendors', partnerSchema),
  ]);
  const counting = countingPurchases(purchaseRecords);
  const confirmed = contracts.filter((contract) => contract.status === 'confirmed');

  const purchases: LedgerPurchase[] = counting.map((purchase) => ({
    id: purchase.id,
    number: purchase.number,
    hotelId: purchase.hotelId,
    vendorId: purchase.vendorId,
    vendorName: vendors.find((vendor) => vendor.id === purchase.vendorId)?.name ?? 'Unknown vendor',
    checkIn: purchase.checkIn,
    checkOut: purchase.checkOut,
    lines: purchase.lines,
  }));
  const sales: LedgerSale[] = confirmed.flatMap((contract) =>
    contract.hotels.flatMap((entry, hotelIndex) =>
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
    ),
  );
  const stamp = [
    ...purchaseRecords.filter((record) => record.status !== 'draft'),
    ...contracts.filter((record) => record.status !== 'draft'),
  ]
    .map((record) => `${record.id}@${String(record.version)}`)
    .sort()
    .join(',');
  return { purchases, sales, stamp };
}
