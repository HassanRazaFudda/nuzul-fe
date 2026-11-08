import { z } from 'zod';

import { SALES_GROUPS } from '../domain/reports';

const isoOrEmpty = z.union([z.literal(''), z.iso.date()]).catch('');

/** Filters every report shares, read from the URL. A bad value falls back, never crashes. */
export const reportParamsSchema = z.object({
  from: isoOrEmpty,
  to: isoOrEmpty,
  hotelId: z.string().max(100).catch(''),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .catch('SAR'),
  policy: z.enum(['transaction', 'revaluation']).catch('transaction'),
  /** The rate date: today unless chosen. */
  on: isoOrEmpty,
});

export const salesParamsSchema = reportParamsSchema.extend({
  groupBy: z.enum(SALES_GROUPS).catch('date'),
  status: z.enum(['confirmed', 'draft', 'cancelled']).catch('confirmed'),
  mealPlan: z.enum(['', 'none', 'perNightPerPerson', 'halfboard', 'fullboard']).catch(''),
  city: z.string().max(100).catch(''),
  rateType: z.enum(['', 'occupancy', 'flat']).catch(''),
});

export type ReportParams = z.infer<typeof reportParamsSchema> & { on: string };
export type SalesParams = z.infer<typeof salesParamsSchema> & { on: string };
