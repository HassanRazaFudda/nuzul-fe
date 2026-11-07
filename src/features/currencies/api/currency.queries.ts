import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import type { CurrencyRecord, CurrencyUpsertPayload } from './currency.schemas';
import { currenciesApi } from './currencies.api';

const REFERENCE_STALE_MS = 10 * 60_000;

export const currencyKeys = {
  all: ['currencies'] as const,
  list: () => [...currencyKeys.all, 'list'] as const,
  rates: () => [...currencyKeys.all, 'rates'] as const,
};

export const currenciesQuery = queryOptions({
  queryKey: currencyKeys.list(),
  queryFn: () => currenciesApi.list(),
  staleTime: REFERENCE_STALE_MS,
});

export const exchangeRatesQuery = queryOptions({
  queryKey: currencyKeys.rates(),
  queryFn: () => currenciesApi.rates(),
  staleTime: REFERENCE_STALE_MS,
});

export function useCreateCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      rateToPkr,
      effectiveFrom,
    }: {
      payload: CurrencyUpsertPayload;
      rateToPkr: string;
      effectiveFrom: string;
    }) => currenciesApi.create(payload, rateToPkr, effectiveFrom),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: currencyKeys.all }),
  });
}

export function useUpdateCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ currency, payload }: { currency: CurrencyRecord; payload: CurrencyUpsertPayload }) =>
      currenciesApi.update(currency, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: currencyKeys.all }),
  });
}

export function useSetCurrencyEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ currency, enabled }: { currency: CurrencyRecord; enabled: boolean }) =>
      currenciesApi.setEnabled(currency, enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: currencyKeys.all }),
  });
}

export function useAddExchangeRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      currencyCode,
      rateToPkr,
      effectiveFrom,
    }: {
      currencyCode: string;
      rateToPkr: string;
      effectiveFrom: string;
    }) => currenciesApi.addRate(currencyCode, rateToPkr, effectiveFrom),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: currencyKeys.rates() }),
  });
}
