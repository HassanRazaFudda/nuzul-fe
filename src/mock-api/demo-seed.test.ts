import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { calendarMonthSchema } from '@/features/calendar';
import { revisionSchema } from '@/features/changes';
import { contractSchema } from '@/features/contracts';
import { currencySchema, exchangeRateSchema } from '@/features/currencies';
import { hotelSchema } from '@/features/hotels';
import { partnerSchema } from '@/features/partners';
import { purchaseSchema } from '@/features/purchases';
import { roomTypeSchema } from '@/features/room-types';

import agents from './seed/agents.json';
import calendarMonths from './seed/calendarMonths.json';
import contracts from './seed/contracts.json';
import currencies from './seed/currencies.json';
import exchangeRates from './seed/exchangeRates.json';
import hotels from './seed/hotels.json';
import purchases from './seed/purchases.json';
import revisions from './seed/revisions.json';
import roomTypes from './seed/roomTypes.json';
import vendors from './seed/vendors.json';

// Tests run on the fixture, so this is what keeps the demo data readable by the app.
const collections: [string, unknown[], z.ZodType][] = [
  ['agents', agents, partnerSchema],
  ['vendors', vendors, partnerSchema],
  ['hotels', hotels, hotelSchema],
  ['roomTypes', roomTypes, roomTypeSchema],
  ['calendarMonths', calendarMonths, calendarMonthSchema],
  ['currencies', currencies, currencySchema],
  ['exchangeRates', exchangeRates, exchangeRateSchema],
  ['purchases', purchases, purchaseSchema],
  ['contracts', contracts, contractSchema],
  ['revisions', revisions, revisionSchema],
];

describe('the demo data', () => {
  it.each(collections)('has %s that match their schema', (_name, records, schema) => {
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) expect(schema.safeParse(record).error).toBeUndefined();
  });
});
