import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { agreementApi } from './agreement.api';

export const agreementKeys = { settings: ['agreement', 'settings'] as const };

export const agreementSettingsQuery = queryOptions({
  queryKey: agreementKeys.settings,
  queryFn: agreementApi.get,
});

export function useSaveAgreementSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: agreementApi.save,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: agreementKeys.settings }),
  });
}
