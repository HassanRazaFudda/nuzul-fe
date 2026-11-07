import { mockDb } from '@/mock-api/db';

import type { CalendarMonth } from '../domain/calendar';
import { calendarMonthSchema } from './calendar.schemas';

export const calendarApi = {
  list: () => mockDb.list('calendarMonths', calendarMonthSchema),
  save: (month: CalendarMonth) => mockDb.put('calendarMonths', month),
  remove: (id: string) => mockDb.remove('calendarMonths', id),
};
