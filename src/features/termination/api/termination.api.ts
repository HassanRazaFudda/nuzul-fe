import { assertSameStamp, impactOf, saveSaleChanges } from '@/features/changes';
import { contractsApi } from '@/features/contracts';
import { contractRecordSchema, loadLedgerSources } from '@/features/inventory';
import { asLedgerPurchase, purchasesApi, purchaseSchema } from '@/features/purchases';
import { ApiError } from '@/lib/api/api-error';
import { moneyLine } from '@/lib/money/money';
import { mockDb } from '@/mock-api/db';
import { assertCan } from '@/mock-api/session';

import { affectedLines, applyTermination, type Decision } from '../domain/termination';

export interface MoneyInput {
  amount: string;
  currencyCode: string;
  rateToPkr: string;
}

export interface TerminationInput {
  purchaseId: string;
  version: number;
  terminationDate: string;
  effectiveDate: string;
  reason: string;
  penalty: MoneyInput | null;
  refund: MoneyInput | null;
  decisions: Record<string, Decision>;
  /** The ledger stamp the preview was worked out from. */
  stamp: string;
}

/**
 * The server's one transaction for a termination: the purchase, its adjustments, and every
 * sale line's decision. Here the steps run one after another against the browser store.
 */
export const terminationApi = {
  terminate: async (input: TerminationInput) => {
    const { purchaseId, version, effectiveDate, reason } = input;
    await assertCan('purchase.terminate');
    await purchasesApi.assertCurrent(purchaseId, version);
    const purchase = await mockDb.get('purchases', purchaseId, purchaseSchema);
    if (!purchase) throw new ApiError({ kind: 'not_found', message: 'Purchase not found' });
    if (effectiveDate <= purchase.checkIn || effectiveDate >= purchase.checkOut) {
      throw new ApiError({
        kind: 'validation',
        message: 'The first released night must fall inside the stay',
      });
    }
    const sources = await loadLedgerSources();
    assertSameStamp(input.stamp, sources.stamp);

    const undecided = affectedLines(sources, purchaseId, effectiveDate).filter(
      (line) => !(line.sale.id in input.decisions),
    );
    if (undecided.length > 0) {
      throw new ApiError({ kind: 'validation', message: 'Every affected sale line needs a decision' });
    }
    const result = applyTermination(
      sources,
      await asLedgerPurchase(purchase),
      effectiveDate,
      input.decisions,
    );
    if (impactOf(sources, result, { before: sources.sales, after: result.sales }).worsens) {
      await assertCan('inventory.override_overbooking');
    }

    await purchasesApi.terminate(
      purchaseId,
      version,
      { terminationDate: input.terminationDate, effectiveDate, reason },
      [
        ...(input.penalty ? [{ kind: 'penalty' as const, money: input.penalty }] : []),
        ...(input.refund ? [{ kind: 'refund' as const, money: input.refund }] : []),
      ].map(({ kind, money }) => ({
        kind,
        amount: moneyLine(money.amount, money.currencyCode, money.rateToPkr),
      })),
    );

    const note = (decisionReason: string) => `${purchase.number} terminated: ${decisionReason || reason}`;
    await saveSaleChanges(result.resourced, 're-sourced', note(''));
    // Each accepted line has its own reason; one history entry per contract keeps them all.
    for (const contractId of new Set(result.accepted.map((sale) => sale.contractId))) {
      const lines = result.accepted.filter((sale) => sale.contractId === contractId);
      const reasons = lines
        .map((sale) => {
          const decision = input.decisions[sale.id];
          return decision && decision.kind !== 'resource' ? decision.reason : '';
        })
        .filter(Boolean)
        .join('; ');
      await saveSaleChanges(lines, 'overbooking-accepted', note(reasons));
    }

    // Line removal shifts positions, so it runs last, a contract at a time.
    for (const contractId of new Set(result.cancelled.map((sale) => sale.contractId))) {
      const lines = result.cancelled.filter((sale) => sale.contractId === contractId);
      const current = await mockDb.get('contracts', contractId, contractRecordSchema);
      if (!current) continue;
      const reasons = lines
        .map((sale) => {
          const decision = input.decisions[sale.id];
          return decision && decision.kind !== 'resource' ? decision.reason : '';
        })
        .filter(Boolean)
        .join('; ');
      await contractsApi.cancelLines(contractId, current.version, lines, note(reasons));
    }
  },
};
