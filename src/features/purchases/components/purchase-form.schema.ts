import { z } from 'zod';

import { exchangeRate, isoDateField, optionalRate, optionalText, wholeNumber } from '@/lib/forms/fields';

import { CHARGE_BASES, MEAL_BASES, type Purchase, type PurchaseInput } from '../api/purchase.schemas';

const MAX_ROOMS_PER_LINE = 9999;
const MAX_GUESTS_PER_ROOM = 20;
const MAX_NOTES_LENGTH = 1000;
const RATE_REQUIRED = 'Enter the cost rate';

const lineSchema = z.object({
  roomTypeId: z.string().min(1, 'Choose a room type'),
  rooms: wholeNumber('number of rooms', 1, MAX_ROOMS_PER_LINE),
  rate: optionalRate,
  personsPerRoom: wholeNumber('persons per room', 1, MAX_GUESTS_PER_ROOM),
});

export const purchaseFormSchema = z
  .object({
    hotelId: z.string().min(1, 'Choose a hotel'),
    vendorId: z.string().min(1, 'Choose a vendor'),
    checkIn: isoDateField,
    checkOut: isoDateField,
    currencyCode: z.string().min(1, 'Choose a currency'),
    rateToPkr: exchangeRate,
    perNight: z.boolean(),
    sameRate: z.boolean(),
    sharedRate: optionalRate,
    lines: z.array(lineSchema).min(1, 'Add at least one room line'),
    mealPricing: z.enum(['none', 'included', 'separate']),
    mealRate: optionalRate,
    mealBasis: z.enum(MEAL_BASES),
    chargeBasis: z.enum(CHARGE_BASES),
    notes: optionalText(MAX_NOTES_LENGTH),
  })
  .superRefine((values, ctx) => {
    if (values.checkOut <= values.checkIn) {
      ctx.addIssue({ code: 'custom', path: ['checkOut'], message: 'Check-out must be after check-in' });
    }
    if (values.mealPricing === 'separate' && values.mealRate === '') {
      ctx.addIssue({ code: 'custom', path: ['mealRate'], message: 'Enter the meal rate' });
    }
    if (values.sameRate && values.sharedRate === '') {
      ctx.addIssue({ code: 'custom', path: ['sharedRate'], message: RATE_REQUIRED });
    }
    const seen = new Set<string>();
    values.lines.forEach((line, index) => {
      if (!values.sameRate && line.rate === '') {
        ctx.addIssue({ code: 'custom', path: ['lines', index, 'rate'], message: RATE_REQUIRED });
      }
      if (seen.has(line.roomTypeId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['lines', index, 'roomTypeId'],
          message: 'This room type is already on the purchase',
        });
      }
      seen.add(line.roomTypeId);
    });
  });

export type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;

export const emptyLine = (): PurchaseFormValues['lines'][number] => ({
  roomTypeId: '',
  rooms: Number.NaN,
  rate: '',
  personsPerRoom: Number.NaN,
});

export function toFormValues(purchase: Purchase): PurchaseFormValues {
  const { meal } = purchase;
  return {
    hotelId: purchase.hotelId,
    vendorId: purchase.vendorId,
    checkIn: purchase.checkIn,
    checkOut: purchase.checkOut,
    currencyCode: purchase.currencyCode,
    rateToPkr: purchase.rateToPkr,
    perNight: purchase.perNight,
    sameRate: purchase.sameRate,
    sharedRate: purchase.sameRate ? (purchase.lines[0]?.rate ?? '') : '',
    lines: purchase.lines.map(({ roomTypeId, rooms, rate, personsPerRoom }) => ({
      roomTypeId,
      rooms,
      rate,
      personsPerRoom,
    })),
    mealPricing: meal.pricing,
    mealRate: meal.pricing === 'separate' ? meal.rate : '',
    mealBasis: meal.pricing === 'separate' ? meal.basis : 'perPersonPerNight',
    chargeBasis: meal.pricing === 'separate' ? meal.chargeBasis : 'fullCapacity',
    notes: purchase.notes,
  };
}

export function toPurchaseInput(values: PurchaseFormValues): PurchaseInput {
  const { sameRate, sharedRate, mealPricing, mealRate, mealBasis, chargeBasis, lines, ...rest } = values;
  return {
    ...rest,
    sameRate,
    lines: lines.map((line) => ({ ...line, rate: sameRate ? sharedRate : line.rate })),
    meal:
      mealPricing === 'separate'
        ? { pricing: 'separate', rate: mealRate, basis: mealBasis, chargeBasis }
        : { pricing: mealPricing },
  };
}
