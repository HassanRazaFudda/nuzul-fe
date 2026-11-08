import { z } from 'zod';

import type { ListParams } from '@/lib/api/pagination';

/** An amount as entered, with the rate it was saved at. Never recalculated afterwards. */
const moneyLineSchema = z.object({
  amount: z.string(),
  currencyCode: z.string(),
  rateToPkr: z.string(),
  amountPkr: z.string(),
});

export const PURCHASE_STATUSES = ['draft', 'confirmed', 'cancelled', 'terminated'] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const MEAL_BASES = ['perPersonPerNight', 'perRoomPerNight', 'perPersonPerStay'] as const;
export const CHARGE_BASES = ['fullCapacity', 'guestsSold'] as const;

const mealSchema = z.discriminatedUnion('pricing', [
  z.object({ pricing: z.literal('none') }),
  z.object({ pricing: z.literal('included') }),
  z.object({
    pricing: z.literal('separate'),
    rate: z.string(),
    basis: z.enum(MEAL_BASES),
    chargeBasis: z.enum(CHARGE_BASES),
  }),
]);

export const purchaseSchema = z.object({
  id: z.string(),
  number: z.string(),
  hotelId: z.string(),
  vendorId: z.string(),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  status: z.enum(PURCHASE_STATUSES),
  version: z.number().int(),
  currencyCode: z.string(),
  rateToPkr: z.string(),
  perNight: z.boolean(),
  sameRate: z.boolean(),
  lines: z.array(
    z.object({
      roomTypeId: z.string(),
      rooms: z.number().int(),
      rate: z.string(),
      personsPerRoom: z.number().int(),
      cost: moneyLineSchema,
    }),
  ),
  meal: mealSchema,
  notes: z.string(),
  /** Set when the vendor ended the contract early. It counts only before the effective date. */
  termination: z
    .object({ terminationDate: z.iso.date(), effectiveDate: z.iso.date(), reason: z.string() })
    .optional(),
  roomCost: moneyLineSchema,
  mealCost: moneyLineSchema,
  mealMaximum: z.string().nullable(),
  total: moneyLineSchema,
});
export type Purchase = z.infer<typeof purchaseSchema>;

/** A penalty or refund from a termination, dated at its effective date. Never a rate change. */
export const adjustmentSchema = z.object({
  id: z.string(),
  purchaseId: z.string(),
  kind: z.enum(['penalty', 'refund']),
  effectiveDate: z.iso.date(),
  reason: z.string(),
  amount: moneyLineSchema,
});
export type Adjustment = z.infer<typeof adjustmentSchema>;

/** A purchase as the API returns it: with names, so a deactivated hotel still reads correctly. */
export type PurchaseView = Purchase & { hotelName: string; vendorName: string };

export const PURCHASE_SORT_FIELDS = ['number', 'checkIn', 'vendor'] as const;
export type PurchaseSortField = (typeof PURCHASE_SORT_FIELDS)[number];

export interface PurchaseListParams extends ListParams<PurchaseSortField> {
  status: PurchaseStatus;
  hotelId: string;
}

/** What the client sends. The transport works out every figure itself, as the API will. */
export type PurchaseInput = Pick<
  Purchase,
  | 'hotelId'
  | 'vendorId'
  | 'checkIn'
  | 'checkOut'
  | 'currencyCode'
  | 'rateToPkr'
  | 'perNight'
  | 'sameRate'
  | 'meal'
  | 'notes'
> & { lines: { roomTypeId: string; rooms: number; rate: string; personsPerRoom: number }[] };
