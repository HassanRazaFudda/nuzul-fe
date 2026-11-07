import { z } from 'zod';

import { exchangeRate, isoDateField, requiredText, wholeNumber } from '@/lib/forms/fields';

export const currencyFormSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Enter a 3-letter code, such as USD'),
  symbol: requiredText('symbol', 6),
  decimals: wholeNumber('number of decimals', 0, 4),
  rateToPkr: z.union([z.literal(''), exchangeRate]),
});
export type CurrencyFormInput = z.input<typeof currencyFormSchema>;
export type CurrencyFormOutput = z.output<typeof currencyFormSchema>;

export const rateFormSchema = z.object({ rateToPkr: exchangeRate, effectiveFrom: isoDateField });
export type RateFormValues = z.infer<typeof rateFormSchema>;
