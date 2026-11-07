import { z } from 'zod';

import { optionalRate, requiredText } from '@/lib/forms/fields';

export const hotelFormSchema = z.object({
  name: requiredText('hotel name'),
  city: requiredText('city'),
  rateCurrency: z.string(),
  flatRate: optionalRate,
  doubleRate: optionalRate,
  extraBedRate: optionalRate,
});
export type HotelFormValues = z.infer<typeof hotelFormSchema>;
