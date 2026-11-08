/**
 * Which records count on the ledger, and for which nights. Pure, and the same rule on the
 * backend later: Confirmed purchases in full, Terminated ones only before their effective
 * date, and the lines of Confirmed contracts.
 */

import type { Allocation } from './allocation';
import type { PoolPurchaseInput, PoolSaleInput } from './pools';

export interface CountableRecord {
  status: string;
  checkIn: string;
  checkOut: string;
  termination?: { effectiveDate: string } | undefined;
}

/** Records as they count: Terminated ones end at their effective date, others drop out. */
export function countingPurchases<T extends CountableRecord>(records: readonly T[]): T[] {
  return records.flatMap((record) => {
    // Locked records still count; they only cannot be changed.
    if (record.status === 'confirmed' || record.status === 'locked') return [record];
    if (record.status !== 'terminated' || !record.termination) return [];
    const { effectiveDate } = record.termination;
    if (effectiveDate <= record.checkIn) return [];
    return [{ ...record, checkOut: effectiveDate < record.checkOut ? effectiveDate : record.checkOut }];
  });
}

export type LedgerPurchase = PoolPurchaseInput & { vendorId: string; vendorName: string };

/** One contract line as the ledger and vendor checks see it. */
export type LedgerSale = PoolSaleInput & {
  contractVersion: number;
  hotelIndex: number;
  lineIndex: number;
  soldAsTypeId: string;
  allocations: Allocation[];
};

export interface LedgerSources {
  purchases: LedgerPurchase[];
  sales: LedgerSale[];
  /**
   * Every counting record's id and version. A change saved against a preview must find the
   * same stamp, or something moved meanwhile and the preview is out of date.
   */
  stamp: string;
}

export const saleKey = (contractId: string, hotelIndex: number, lineIndex: number) =>
  `${contractId}:${String(hotelIndex)}:${String(lineIndex)}`;
