import { z } from 'zod';

import { optionalEmail, optionalText, requiredText } from '@/lib/forms/fields';

const MAX_PHONE_LENGTH = 40;
const MAX_ADDRESS_LENGTH = 400;

export const partnerFormSchema = z.object({
  name: requiredText('name'),
  company: optionalText(),
  contactPerson: optionalText(),
  phone: optionalText(MAX_PHONE_LENGTH),
  email: optionalEmail,
  address: optionalText(MAX_ADDRESS_LENGTH),
});
export type PartnerFormValues = z.infer<typeof partnerFormSchema>;
