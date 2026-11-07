import { mockDb } from '@/mock-api/db';

import {
  currencySchema,
  exchangeRateSchema,
  type CurrencyRecord,
  type CurrencyUpsertPayload,
} from './currency.schemas';

/** Thin, typed transport functions. No React, no caching, no UI concerns. */
export const currenciesApi = {
  list: () => mockDb.list('currencies', currencySchema),

  rates: () => mockDb.list('exchangeRates', exchangeRateSchema),

  /** A new currency always arrives with its first rate. */
  create: async (payload: CurrencyUpsertPayload, rateToPkr: string, effectiveFrom: string) => {
    await mockDb.put('currencies', { ...payload, id: payload.code, enabled: true } satisfies CurrencyRecord);
    await currenciesApi.addRate(payload.code, rateToPkr, effectiveFrom);
  },

  update: (currency: CurrencyRecord, payload: CurrencyUpsertPayload) =>
    mockDb.put('currencies', { ...currency, symbol: payload.symbol, decimals: payload.decimals }),

  setEnabled: (currency: CurrencyRecord, enabled: boolean) =>
    mockDb.put('currencies', { ...currency, enabled }),

  /** The history is append-only: an old rate is never overwritten. */
  addRate: (currencyCode: string, rateToPkr: string, effectiveFrom: string) =>
    mockDb.put('exchangeRates', { id: crypto.randomUUID(), currencyCode, rateToPkr, effectiveFrom }),
};
