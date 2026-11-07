import { z } from 'zod';

export const calendarMonthSchema = z.object({
  id: z.string(),
  cycle: z.string(),
  ordinal: z.number().int(),
  name: z.string(),
  days: z.number().int(),
  startDate: z.iso.date(),
});
