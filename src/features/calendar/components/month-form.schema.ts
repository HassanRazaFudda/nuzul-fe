import { z } from 'zod';

import { isoDateField, requiredText, wholeNumber } from '@/lib/forms/fields';

const MAX_DAYS_IN_MONTH = 60;

export const monthFormSchema = z.object({
  cycle: requiredText('year or cycle', 20),
  ordinal: wholeNumber('position in the year', 1, 99),
  name: requiredText('month name', 40),
  days: wholeNumber('number of days', 1, MAX_DAYS_IN_MONTH),
  startDate: isoDateField,
});
export type MonthFormValues = z.infer<typeof monthFormSchema>;
