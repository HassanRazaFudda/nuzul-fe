import { z } from 'zod';

import { assertSameStamp, revisionsApi, saveSaleChanges, type RevisionAction } from '@/features/changes';
import { currencySchema } from '@/features/currencies';
import { hotelSchema } from '@/features/hotels';
import { countingPurchases, loadLedgerSources, type LedgerPurchase } from '@/features/inventory';
import { partnerSchema } from '@/features/partners';
import { ApiError } from '@/lib/api/api-error';
import { nightsBetween } from '@/lib/format/dates';
import { moneyLine } from '@/lib/money/money';
import { mockDb } from '@/mock-api/db';
import { assertCan } from '@/mock-api/session';
import { pageOf } from '@/mock-api/list-query';

import { purchaseChange, purchaseImpact } from '../domain/purchase-change';
import { purchaseTotals } from '../domain/purchase-totals';
import {
  adjustmentSchema,
  PURCHASE_STATUSES,
  purchaseSchema,
  type Adjustment,
  type Purchase,
  type PurchaseInput,
  type PurchaseListParams,
  type PurchaseStatus,
  type PurchaseView,
} from './purchase.schemas';

const counterSchema = z.object({ id: z.string(), value: z.number().int() });
const NUMBER_PADDING = 4;

async function withNames(purchases: Purchase[]): Promise<PurchaseView[]> {
  const [hotels, vendors] = await Promise.all([
    mockDb.list('hotels', hotelSchema),
    mockDb.list('vendors', partnerSchema),
  ]);
  return purchases.map((purchase) => ({
    ...purchase,
    hotelName: hotels.find((hotel) => hotel.id === purchase.hotelId)?.name ?? 'Unknown hotel',
    vendorName: vendors.find((vendor) => vendor.id === purchase.vendorId)?.name ?? 'Unknown vendor',
  }));
}

async function takeNumber(): Promise<string> {
  const counter = await mockDb.get('counters', 'purchase', counterSchema);
  const value = (counter?.value ?? 0) + 1;
  await mockDb.put('counters', { id: 'purchase', value });
  return `PUR-${String(value).padStart(NUMBER_PADDING, '0')}`;
}

/** Every figure comes from here, so a client-sent total could never be saved. */
async function priced(input: PurchaseInput) {
  const currency = await mockDb.get('currencies', input.currencyCode, currencySchema);
  if (!currency) {
    throw new ApiError({ kind: 'validation', message: `${input.currencyCode} is not a known currency` });
  }
  const totals = purchaseTotals(
    {
      nights: nightsBetween(input.checkIn, input.checkOut),
      perNight: input.perNight,
      lines: input.lines,
      meal: input.meal,
    },
    currency.decimals,
  );
  const frozen = (amount: string) => moneyLine(amount, input.currencyCode, input.rateToPkr);
  return {
    ...input,
    lines: input.lines.map((line, index) => ({ ...line, cost: frozen(totals.lineCosts[index] ?? '0') })),
    roomCost: frozen(totals.roomCost),
    mealCost: frozen(totals.mealCost),
    mealMaximum: totals.mealMaximum,
    total: frozen(totals.total),
  };
}

/** The record as stored now, or an error if someone else changed it first. */
async function current(id: string, version: number, allowed: PurchaseStatus): Promise<Purchase> {
  const purchase = await mockDb.get('purchases', id, purchaseSchema);
  if (!purchase) throw new ApiError({ kind: 'not_found', message: 'Purchase not found' });
  if (purchase.version !== version || purchase.status !== allowed) {
    throw new ApiError({ kind: 'conflict', message: 'This purchase has changed' });
  }
  return purchase;
}

/** Going ahead with a change that overbooks needs the override; otherwise it never blocks. */
export async function assertOverbookingAllowed(worsens: boolean) {
  if (worsens) await assertCan('inventory.override_overbooking');
}

/** Saves the next version of a purchase, and its history entry. */
async function saveVersion(before: Purchase, after: Purchase, action: RevisionAction, reason: string) {
  const saved = await mockDb.put('purchases', after);
  await revisionsApi.record({
    entity: 'purchase',
    entityId: after.id,
    version: after.version,
    action,
    reason,
    before,
    totalBefore: before.total.amount,
    totalAfter: after.total.amount,
  });
  return saved;
}

/** The purchase as the ledger and vendor checks will count it. */
export async function asLedgerPurchase(
  purchase: Purchase | (PurchaseInput & { id: string; number: string }),
) {
  const vendor = await mockDb.get('vendors', purchase.vendorId, partnerSchema);
  return {
    id: purchase.id,
    number: purchase.number,
    hotelId: purchase.hotelId,
    vendorId: purchase.vendorId,
    vendorName: vendor?.name ?? 'Unknown vendor',
    checkIn: purchase.checkIn,
    checkOut: purchase.checkOut,
    lines: purchase.lines.map(({ roomTypeId, rooms }) => ({ roomTypeId, rooms })),
  } satisfies LedgerPurchase;
}

export const purchasesApi = {
  list: async (params: PurchaseListParams) => {
    await assertCan('purchase.view');
    const stored = await mockDb.list('purchases', purchaseSchema);
    const inHotel = params.hotelId ? stored.filter((item) => item.hotelId === params.hotelId) : stored;
    const named = await withNames(inHotel);
    const counts = Object.fromEntries(
      PURCHASE_STATUSES.map((status) => [status, named.filter((item) => item.status === status).length]),
    ) as Record<PurchaseStatus, number>;
    return {
      ...pageOf(
        named.filter((item) => item.status === params.status),
        params,
        {
          searchText: (item) => `${item.number} ${item.hotelName} ${item.vendorName}`,
          sortValue: {
            number: (item) => item.number,
            checkIn: (item) => item.checkIn,
            vendor: (item) => item.vendorName,
          },
        },
      ),
      counts,
    };
  },

  get: async (id: string): Promise<PurchaseView> => {
    await assertCan('purchase.view');
    const purchase = await mockDb.get('purchases', id, purchaseSchema);
    if (!purchase) throw new ApiError({ kind: 'not_found', message: 'Purchase not found' });
    const [named] = await withNames([purchase]);
    if (!named) throw new ApiError({ kind: 'not_found', message: 'Purchase not found' });
    return named;
  },

  /** The purchases that count on the ledger: Terminated ones end at their effective date. */
  counting: async () => countingPurchases(await mockDb.list('purchases', purchaseSchema)),

  adjustments: async (purchaseId: string): Promise<Adjustment[]> => {
    await assertCan('purchase.view');
    const all = await mockDb.list('adjustments', adjustmentSchema);
    return all.filter((adjustment) => adjustment.purchaseId === purchaseId);
  },

  create: async (input: PurchaseInput) => {
    await assertCan('purchase.create');
    const record: Purchase = {
      ...(await priced(input)),
      id: crypto.randomUUID(),
      number: await takeNumber(),
      status: 'draft',
      version: 1,
    };
    const saved = await mockDb.put('purchases', record);
    await revisionsApi.record({
      entity: 'purchase',
      entityId: saved.id,
      version: 1,
      action: 'created',
      reason: '',
      before: null,
      totalBefore: null,
      totalAfter: saved.total.amount,
    });
    return saved;
  },

  update: async (id: string, version: number, input: PurchaseInput) => {
    await assertCan('purchase.edit');
    const purchase = await current(id, version, 'draft');
    return saveVersion(
      purchase,
      { ...purchase, ...(await priced(input)), version: version + 1 },
      'edited',
      '',
    );
  },

  confirm: async (id: string, version: number) => {
    await assertCan('purchase.confirm');
    const purchase = await current(id, version, 'draft');
    return saveVersion(purchase, { ...purchase, status: 'confirmed', version: version + 1 }, 'confirmed', '');
  },

  /**
   * Edits a Confirmed purchase. Sales that lose their rooms keep the rest of their
   * allocations; the part no longer supplied becomes Unallocated. `stamp` is the one the
   * preview was worked out from.
   */
  updateConfirmed: async (
    id: string,
    version: number,
    input: PurchaseInput,
    reason: string,
    stamp: string,
  ) => {
    await assertCan('purchase.edit');
    const purchase = await current(id, version, 'confirmed');
    const sources = await loadLedgerSources();
    assertSameStamp(stamp, sources.stamp);
    const after: Purchase = { ...purchase, ...(await priced(input)), version: version + 1 };
    const replacement = await asLedgerPurchase(after);
    await assertOverbookingAllowed(purchaseImpact(sources, id, replacement).worsens);
    const change = purchaseChange(sources, id, replacement);
    const saved = await saveVersion(purchase, after, 'edited', reason);
    await saveSaleChanges(change.changedSales, 'vendor-released', `${purchase.number} edited: ${reason}`);
    return saved;
  },

  /** A Confirmed purchase is cancelled, never erased. The sales it supplied become Unallocated. */
  cancel: async (id: string, version: number, reason: string, stamp: string) => {
    await assertCan('purchase.delete');
    const purchase = await current(id, version, 'confirmed');
    const sources = await loadLedgerSources();
    assertSameStamp(stamp, sources.stamp);
    await assertOverbookingAllowed(purchaseImpact(sources, id, null).worsens);
    const change = purchaseChange(sources, id, null);
    const saved = await saveVersion(
      purchase,
      { ...purchase, status: 'cancelled', version: version + 1 },
      'cancelled',
      reason,
    );
    await saveSaleChanges(change.changedSales, 'vendor-released', `${purchase.number} cancelled: ${reason}`);
    return saved;
  },

  /** Only a Draft can be deleted. A Confirmed purchase is cancelled, and stays on record. */
  remove: async (id: string, version: number) => {
    await assertCan('purchase.delete');
    await current(id, version, 'draft');
    await mockDb.remove('purchases', id);
  },

  /** Part of a termination: the server saves this with the contracts' decisions as one change. */
  terminate: async (
    id: string,
    version: number,
    termination: NonNullable<Purchase['termination']>,
    adjustments: Omit<Adjustment, 'id' | 'purchaseId' | 'effectiveDate' | 'reason'>[],
  ) => {
    await assertCan('purchase.terminate');
    const purchase = await current(id, version, 'confirmed');
    const saved = await saveVersion(
      purchase,
      { ...purchase, status: 'terminated', termination, version: version + 1 },
      'terminated',
      termination.reason,
    );
    for (const adjustment of adjustments) {
      await mockDb.put('adjustments', {
        ...adjustment,
        id: crypto.randomUUID(),
        purchaseId: id,
        effectiveDate: termination.effectiveDate,
        reason: termination.reason,
      } satisfies Adjustment);
    }
    return saved;
  },

  /** A Locked purchase still counts, but nobody can change it until it is unlocked. */
  setLocked: async (id: string, version: number, locked: boolean) => {
    await assertCan('purchase.unlock');
    const purchase = await current(id, version, locked ? 'confirmed' : 'locked');
    return saveVersion(
      purchase,
      { ...purchase, status: locked ? 'locked' : 'confirmed', version: version + 1 },
      locked ? 'locked' : 'unlocked',
      '',
    );
  },

  /** Brings a Cancelled purchase back. It only adds rooms, so it can never overbook. */
  restore: async (id: string, version: number, reason: string, stamp: string) => {
    await assertCan('purchase.edit');
    const purchase = await current(id, version, 'cancelled');
    assertSameStamp(stamp, (await loadLedgerSources()).stamp);
    return saveVersion(
      purchase,
      { ...purchase, status: 'confirmed', version: version + 1 },
      'restored',
      reason,
    );
  },

  /** Throws a conflict unless the purchase is still this version of a Confirmed record. */
  assertCurrent: async (id: string, version: number) => {
    await current(id, version, 'confirmed');
  },
};
