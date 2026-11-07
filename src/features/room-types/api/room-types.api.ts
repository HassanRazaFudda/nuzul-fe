import { mockDb } from '@/mock-api/db';

import type { ConversionRule, RoomType } from '../domain/conversion';
import { conversionRuleSchema, roomTypeSchema } from './room-type.schemas';

export const roomTypesApi = {
  list: () => mockDb.list('roomTypes', roomTypeSchema),
  save: (roomType: RoomType) => mockDb.put('roomTypes', roomType),
  rules: () => mockDb.list('conversionRules', conversionRuleSchema),
  saveRule: (rule: ConversionRule) => mockDb.put('conversionRules', rule),
  removeRule: (id: string) => mockDb.remove('conversionRules', id),
};
