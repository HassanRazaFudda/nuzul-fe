/** Field rules shared by the forms. Money stays a decimal string from form to storage. */

import { z } from 'zod';

export const requiredText = (label: string, max = 120) =>
  z.string().trim().min(1, `Enter the ${label}`).max(max, `Keep it under ${max} characters`);

export const optionalText = (max = 200) => z.string().trim().max(max, `Keep it under ${max} characters`);

export const optionalEmail = z.union([z.literal(''), z.email('Enter a valid email address')]);

const RATE = /^\d{1,10}(\.\d{1,4})?$/;
const RATE_MESSAGE = 'Enter a number, with up to 4 decimals';

/** A rate of up to 4 decimals, or nothing. */
export const optionalRate = z
  .string()
  .trim()
  .regex(new RegExp(`(${RATE.source})|^$`), RATE_MESSAGE);

/** A required rate of up to 4 decimals. */
export const requiredRate = (label = 'rate') =>
  z.string().trim().min(1, `Enter the ${label}`).regex(RATE, RATE_MESSAGE);

/** An exchange rate: above zero, up to 8 decimals. */
export const exchangeRate = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,8})?$/, 'Enter a number, with up to 8 decimals')
  .refine((value) => /[1-9]/.test(value), 'The rate must be above zero');

export const isoDateField = z.iso.date({ error: 'Choose a date' });

/** An input with `valueAsNumber` gives NaN when empty; this names that case. */
export const wholeNumber = (label: string, min: number, max: number) =>
  z
    .number({ error: `Enter the ${label}` })
    .int('Enter a whole number')
    .min(min, `At least ${min}`)
    .max(max, `At most ${max}`);
