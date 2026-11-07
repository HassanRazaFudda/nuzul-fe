import { z } from 'zod';

export const roomTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  capacity: z.number().int(),
});

export const conversionRuleSchema = z.object({
  id: z.string(),
  hotelId: z.string().nullable(),
  sourceTypeId: z.string(),
  soldAsTypeId: z.string(),
  allowed: z.boolean(),
});
