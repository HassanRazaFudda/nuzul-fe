import { z } from 'zod';

import type { RoomType } from '@/features/room-types';
import { exchangeRate, isoDateField, optionalRate, optionalText, wholeNumber } from '@/lib/forms/fields';

import { MEAL_PLANS, type Contract, type ContractInput, type ContractView } from '../api/contract.schemas';
import { allocationProblems, type Supply, type TakenRooms } from '@/features/inventory';

const MAX_ROOMS_PER_LINE = 9999;
const MAX_GUESTS_PER_ROOM = 20;
const MAX_NOTES_LENGTH = 1000;
const DOUBLE_CAPACITY = 2;

const allocationSchema = z.object({
  purchaseId: z.string().min(1, 'Choose a purchase'),
  checkIn: isoDateField,
  checkOut: isoDateField,
  rooms: wholeNumber('number of rooms', 1, MAX_ROOMS_PER_LINE),
});

const lineSchema = z.object({
  soldAsTypeId: z.string().min(1, 'Choose a room type'),
  sourceTypeId: z.string().min(1, 'Choose a source'),
  rooms: wholeNumber('number of rooms', 1, MAX_ROOMS_PER_LINE),
  personsPerRoom: wholeNumber('persons per room', 1, MAX_GUESTS_PER_ROOM),
  allocations: z.array(allocationSchema),
});

const entrySchema = z.object({
  hotelId: z.string().min(1, 'Choose a hotel'),
  checkIn: isoDateField,
  checkOut: isoDateField,
  perNight: z.boolean(),
  rateType: z.enum(['occupancy', 'flat']),
  doubleRate: optionalRate,
  extraBedRate: optionalRate,
  flatRate: optionalRate,
  noMeals: z.boolean(),
  lines: z.array(lineSchema).min(1, 'Add at least one room line'),
});

const baseSchema = z.object({
  agentId: z.string().min(1, 'Choose an agent'),
  date: isoDateField,
  currencyCode: z.string().min(1, 'Choose a currency'),
  rateToPkr: exchangeRate,
  mealKind: z.enum(['none', ...MEAL_PLANS]),
  mealRate: optionalRate,
  notes: optionalText(MAX_NOTES_LENGTH),
  hotels: z.array(entrySchema).min(1, 'Add at least one hotel'),
});

export type ContractFormValues = z.infer<typeof baseSchema>;

/** Allocations this form holds, apart from one line's, since those rooms are spoken for too. */
export function takenByOtherLines(
  values: Pick<ContractFormValues, 'hotels'>,
  hotelIndex: number,
  lineIndex: number,
): TakenRooms[] {
  return values.hotels.flatMap((entry, h) =>
    entry.lines.flatMap((line, l) =>
      h === hotelIndex && l === lineIndex
        ? []
        : line.allocations.map((allocation) => ({ ...allocation, roomTypeId: line.sourceTypeId })),
    ),
  );
}

interface SchemaContext {
  roomTypes: readonly RoomType[];
  supplies: readonly Supply[];
  taken: readonly TakenRooms[];
}

export function contractFormSchema({ roomTypes, supplies, taken }: SchemaContext) {
  return baseSchema.superRefine((values, ctx) => {
    if (values.mealKind !== 'none' && values.mealRate === '') {
      ctx.addIssue({ code: 'custom', path: ['mealRate'], message: 'Enter the meal rate' });
    }
    values.hotels.forEach((entry, h) => {
      const entryPath = ['hotels', h];
      if (entry.checkOut <= entry.checkIn) {
        ctx.addIssue({
          code: 'custom',
          path: [...entryPath, 'checkOut'],
          message: 'Check-out must be after check-in',
        });
      }
      if (entry.rateType === 'flat' && entry.flatRate === '') {
        ctx.addIssue({ code: 'custom', path: [...entryPath, 'flatRate'], message: 'Enter the flat rate' });
      }
      if (entry.rateType === 'occupancy') {
        if (entry.doubleRate === '') {
          ctx.addIssue({
            code: 'custom',
            path: [...entryPath, 'doubleRate'],
            message: 'Enter the double room rate',
          });
        }
        const needsExtraBed = entry.lines.some(
          (line) =>
            (roomTypes.find((type) => type.id === line.soldAsTypeId)?.capacity ?? 0) > DOUBLE_CAPACITY,
        );
        if (needsExtraBed && entry.extraBedRate === '') {
          ctx.addIssue({
            code: 'custom',
            path: [...entryPath, 'extraBedRate'],
            message: 'Enter the extra bed rate',
          });
        }
      }
      entry.lines.forEach((line, l) => {
        const problems = allocationProblems(
          {
            hotelId: entry.hotelId,
            roomTypeId: line.sourceTypeId,
            checkIn: entry.checkIn,
            checkOut: entry.checkOut,
            rooms: line.rooms,
          },
          line.allocations,
          supplies,
          [...taken, ...takenByOtherLines(values, h, l)],
        );
        for (const problem of problems) {
          ctx.addIssue({
            code: 'custom',
            path: [...entryPath, 'lines', l, 'allocations', problem.index, problem.field],
            message: problem.message,
          });
        }
      });
    });
  });
}

export const emptyLine = (): ContractFormValues['hotels'][number]['lines'][number] => ({
  soldAsTypeId: '',
  sourceTypeId: '',
  rooms: Number.NaN,
  personsPerRoom: Number.NaN,
  allocations: [],
});

export const emptyEntry = (): ContractFormValues['hotels'][number] => ({
  hotelId: '',
  checkIn: '',
  checkOut: '',
  perNight: true,
  rateType: 'occupancy',
  doubleRate: '',
  extraBedRate: '',
  flatRate: '',
  noMeals: false,
  lines: [emptyLine()],
});

export function toFormValues(contract: ContractView | Contract): ContractFormValues {
  const { mealPlan } = contract;
  return {
    agentId: contract.agentId,
    date: contract.date,
    currencyCode: contract.currencyCode,
    rateToPkr: contract.rateToPkr,
    mealKind: mealPlan.kind,
    mealRate: mealPlan.kind === 'none' ? '' : mealPlan.rate,
    notes: contract.notes,
    hotels: contract.hotels.map((entry) => ({
      hotelId: entry.hotelId,
      checkIn: entry.checkIn,
      checkOut: entry.checkOut,
      perNight: entry.perNight,
      rateType: entry.rateType,
      doubleRate: entry.doubleRate,
      extraBedRate: entry.extraBedRate,
      flatRate: entry.flatRate,
      noMeals: entry.noMeals,
      lines: entry.lines.map((line) => ({
        soldAsTypeId: line.soldAsTypeId,
        sourceTypeId: line.sourceTypeId,
        rooms: line.rooms,
        personsPerRoom: line.personsPerRoom,
        allocations: line.allocations.map(({ purchaseId, checkIn, checkOut, rooms }) => ({
          purchaseId,
          checkIn,
          checkOut,
          rooms,
        })),
      })),
    })),
  };
}

export function toContractInput(values: ContractFormValues): ContractInput {
  const { mealKind, mealRate, ...rest } = values;
  return {
    ...rest,
    mealPlan: mealKind === 'none' ? { kind: 'none' } : { kind: mealKind, rate: mealRate },
  };
}
