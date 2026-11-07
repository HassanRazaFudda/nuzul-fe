import { z } from 'zod';

export const currencySchema = z.object({
  id: z.string(),
  code: z.string().length(3),
  symbol: z.string(),
  decimals: z.number().int().min(0),
  enabled: z.boolean(),
});
export type CurrencyRecord = z.infer<typeof currencySchema>;

export const exchangeRateSchema = z.object({
  id: z.string(),
  currencyCode: z.string().length(3),
  rateToPkr: z.string(),
  effectiveFrom: z.iso.date(),
});
export type ExchangeRateRecord = z.infer<typeof exchangeRateSchema>;

/** PKR is what rates are measured against; SAR is the default for new records. */
export const RATE_BASE_CURRENCY = 'PKR';
export const DEFAULT_CURRENCY = 'SAR';

export interface CurrencyUpsertPayload {
  code: string;
  symbol: string;
  decimals: number;
}
