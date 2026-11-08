import { mockDb } from '@/mock-api/db';
import { removeAudited, saveAudited } from '@/mock-api/session';

import type { ConversionRule, RoomType } from '../domain/conversion';
import { conversionRuleSchema, roomTypeSchema } from './room-type.schemas';

export const roomTypesApi = {
  list: () => mockDb.list('roomTypes', roomTypeSchema),
  save: (roomType: RoomType) => saveAudited('conversion.manage', 'roomTypes', 'roomType', 'edited', roomType),
  rules: () => mockDb.list('conversionRules', conversionRuleSchema),
  saveRule: (rule: ConversionRule) =>
    saveAudited('conversion.manage', 'conversionRules', 'conversionRule', 'edited', rule),
  removeRule: (id: string) => removeAudited('conversion.manage', 'conversionRules', 'conversionRule', id),
};
