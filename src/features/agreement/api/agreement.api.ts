import { ApiError } from '@/lib/api/api-error';
import { mockDb } from '@/mock-api/db';
import { saveAudited } from '@/mock-api/session';

import {
  agreementSettingsSchema,
  storedAgreementSettingsSchema,
  type AgreementSettings,
} from './agreement.schemas';

export const agreementApi = {
  /** Anyone who can open a contract can print it, so reading needs no permission. */
  get: async (): Promise<AgreementSettings> => {
    const settings = await mockDb.get('settings', 'agreement', storedAgreementSettingsSchema);
    if (!settings) throw new ApiError({ kind: 'not_found', message: 'Agreement settings not found' });
    return settings;
  },

  save: (settings: AgreementSettings) =>
    saveAudited('settings.manage', 'settings', 'settings', 'edited', agreementSettingsSchema.parse(settings)),
};
