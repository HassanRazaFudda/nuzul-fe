import { mockDb } from '@/mock-api/db';
import { removeAudited, saveAudited } from '@/mock-api/session';

import type { CalendarMonth } from '../domain/calendar';
import { calendarMonthSchema } from './calendar.schemas';

export const calendarApi = {
  list: () => mockDb.list('calendarMonths', calendarMonthSchema),
  save: (month: CalendarMonth) =>
    saveAudited('calendar.manage', 'calendarMonths', 'calendarMonth', 'edited', month),
  remove: (id: string) => removeAudited('calendar.manage', 'calendarMonths', 'calendarMonth', id),
};
