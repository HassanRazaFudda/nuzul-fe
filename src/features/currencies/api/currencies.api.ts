import { mockDb } from '@/mock-api/db';
import { assertCan, recordAudit, saveAudited } from '@/mock-api/session';

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
    await saveAudited('currency.manage_rates', 'currencies', 'currency', 'created', {
      ...payload,
      id: payload.code,
      enabled: true,
    } satisfies CurrencyRecord);
    await currenciesApi.addRate(payload.code, rateToPkr, effectiveFrom);
  },

  update: (currency: CurrencyRecord, payload: CurrencyUpsertPayload) =>
    saveAudited('currency.manage_rates', 'currencies', 'currency', 'edited', {
      ...currency,
      symbol: payload.symbol,
      decimals: payload.decimals,
    }),

  setEnabled: (currency: CurrencyRecord, enabled: boolean) =>
    saveAudited('currency.manage_rates', 'currencies', 'currency', enabled ? 'activated' : 'deactivated', {
      ...currency,
      enabled,
    }),

  /** The history is append-only: an old rate is never overwritten. */
  addRate: async (currencyCode: string, rateToPkr: string, effectiveFrom: string) => {
    await assertCan('currency.manage_rates');
    const rate = { id: crypto.randomUUID(), currencyCode, rateToPkr, effectiveFrom };
    await mockDb.put('exchangeRates', rate);
    await recordAudit({
      entity: 'currency',
      entityId: currencyCode,
      action: 'rate-added',
      before: null,
      after: rate,
    });
  },
};
