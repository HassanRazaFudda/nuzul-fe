import { z } from 'zod';

import { currencySchema } from '@/features/currencies';
import { hotelSchema } from '@/features/hotels';
import { partnerSchema } from '@/features/partners';
import { ApiError } from '@/lib/api/api-error';
import { nightsBetween } from '@/lib/format/dates';
import { moneyLine } from '@/lib/money/money';
import { mockDb } from '@/mock-api/db';
import { pageOf } from '@/mock-api/list-query';

import { purchaseTotals } from '../domain/purchase-totals';
import {
  purchaseSchema,
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

async function moveTo(purchase: Purchase, status: PurchaseStatus) {
  return mockDb.put('purchases', { ...purchase, status, version: purchase.version + 1 });
}

export const purchasesApi = {
  list: async (params: PurchaseListParams) => {
    const stored = await mockDb.list('purchases', purchaseSchema);
    const inHotel = params.hotelId ? stored.filter((item) => item.hotelId === params.hotelId) : stored;
    const named = await withNames(inHotel);
    const count = (status: PurchaseStatus) => named.filter((item) => item.status === status).length;
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
      counts: { draft: count('draft'), confirmed: count('confirmed'), cancelled: count('cancelled') },
    };
  },

  get: async (id: string): Promise<PurchaseView> => {
    const purchase = await mockDb.get('purchases', id, purchaseSchema);
    if (!purchase) throw new ApiError({ kind: 'not_found', message: 'Purchase not found' });
    const [named] = await withNames([purchase]);
    if (!named) throw new ApiError({ kind: 'not_found', message: 'Purchase not found' });
    return named;
  },

  /** Only Confirmed purchases count on the ledger. */
  confirmed: async () => {
    const stored = await mockDb.list('purchases', purchaseSchema);
    return stored.filter((purchase) => purchase.status === 'confirmed');
  },

  create: async (input: PurchaseInput) => {
    const record: Purchase = {
      ...(await priced(input)),
      id: crypto.randomUUID(),
      number: await takeNumber(),
      status: 'draft',
      version: 1,
    };
    return mockDb.put('purchases', record);
  },

  update: async (id: string, version: number, input: PurchaseInput) => {
    const purchase = await current(id, version, 'draft');
    return mockDb.put('purchases', { ...purchase, ...(await priced(input)), version: version + 1 });
  },

  confirm: async (id: string, version: number) => moveTo(await current(id, version, 'draft'), 'confirmed'),

  cancel: async (id: string, version: number) => moveTo(await current(id, version, 'confirmed'), 'cancelled'),

  /** Only a Draft can be deleted. A Confirmed purchase is cancelled, and stays on record. */
  remove: async (id: string, version: number) => {
    await current(id, version, 'draft');
    await mockDb.remove('purchases', id);
  },
};
