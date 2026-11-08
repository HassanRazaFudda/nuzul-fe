import { z } from 'zod';

import type { ListParams } from '@/lib/api/pagination';

import type { LineTags } from '../domain/overbooking';

const moneyLineSchema = z.object({
  amount: z.string(),
  currencyCode: z.string(),
  rateToPkr: z.string(),
  amountPkr: z.string(),
});

export const CONTRACT_STATUSES = ['draft', 'confirmed', 'locked', 'cancelled'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const MEAL_PLANS = ['perNightPerPerson', 'halfboard', 'fullboard'] as const;
export type MealPlanKind = (typeof MEAL_PLANS)[number];

const mealPlanSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.enum(MEAL_PLANS), rate: z.string() }),
]);

const allocationSchema = z.object({
  purchaseId: z.string(),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  rooms: z.number().int(),
});

const contractLineSchema = z.object({
  soldAsTypeId: z.string(),
  sourceTypeId: z.string(),
  rooms: z.number().int(),
  personsPerRoom: z.number().int(),
  rate: z.string(),
  allocations: z.array(allocationSchema),
  roomAmount: moneyLineSchema,
  mealIncome: moneyLineSchema,
});

const hotelEntrySchema = z.object({
  hotelId: z.string(),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  perNight: z.boolean(),
  rateType: z.enum(['occupancy', 'flat']),
  doubleRate: z.string(),
  extraBedRate: z.string(),
  flatRate: z.string(),
  noMeals: z.boolean(),
  lines: z.array(contractLineSchema),
  roomAmount: moneyLineSchema,
  mealIncome: moneyLineSchema,
  total: moneyLineSchema,
});

export const contractSchema = z.object({
  id: z.string(),
  number: z.string(),
  agentId: z.string(),
  date: z.iso.date(),
  status: z.enum(CONTRACT_STATUSES),
  version: z.number().int(),
  currencyCode: z.string(),
  rateToPkr: z.string(),
  mealPlan: mealPlanSchema,
  notes: z.string(),
  hotels: z.array(hotelEntrySchema),
  roomAmount: moneyLineSchema,
  mealIncome: moneyLineSchema,
  total: moneyLineSchema,
});
export type Contract = z.infer<typeof contractSchema>;
export type ContractHotelEntry = Contract['hotels'][number];
export type ContractLine = ContractHotelEntry['lines'][number];

/** What the client sends. The transport works out every figure itself, as the API will. */
export interface ContractInput {
  agentId: string;
  date: string;
  currencyCode: string;
  rateToPkr: string;
  mealPlan: Contract['mealPlan'];
  notes: string;
  hotels: (Pick<
    ContractHotelEntry,
    | 'hotelId'
    | 'checkIn'
    | 'checkOut'
    | 'perNight'
    | 'rateType'
    | 'doubleRate'
    | 'extraBedRate'
    | 'flatRate'
    | 'noMeals'
  > & {
    lines: Pick<ContractLine, 'soldAsTypeId' | 'sourceTypeId' | 'rooms' | 'personsPerRoom' | 'allocations'>[];
  })[];
}

export type AllocationView = ContractLine['allocations'][number] & { number: string; vendorName: string };

/** A contract as the API returns it: with names, and tags worked out from the ledger. */
export type ContractView = Omit<Contract, 'hotels'> & {
  agentName: string;
  /** The agent's company for documents, or their name when no company is set. */
  agentCompany: string;
  tags: LineTags;
  hotels: (Omit<ContractHotelEntry, 'lines'> & {
    hotelName: string;
    lines: (Omit<ContractLine, 'allocations'> & { allocations: AllocationView[]; tags: LineTags })[];
  })[];
};

export const CONTRACT_SORT_FIELDS = ['number', 'date', 'agent'] as const;
export type ContractSortField = (typeof CONTRACT_SORT_FIELDS)[number];

export interface ContractListParams extends ListParams<ContractSortField> {
  status: ContractStatus;
  hotelId: string;
}
