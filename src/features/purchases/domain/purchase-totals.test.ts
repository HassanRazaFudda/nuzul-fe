import { describe, expect, it } from 'vitest';

import { nightsBetween } from '@/lib/format/dates';
import { moneyLine } from '@/lib/money/money';
import seed from '@/test/fixtures/seed/purchases.json';

import { purchaseSchema } from '../api/purchase.schemas';
import { purchaseTotals, referenceRate, type Meal } from './purchase-totals';

const FIVE_DOUBLE = [{ rooms: 5, rate: '100', personsPerRoom: 2 }];
const separate = (basis: 'perPersonPerNight' | 'perRoomPerNight' | 'perPersonPerStay'): Meal => ({
  pricing: 'separate',
  rate: '50',
  basis,
  chargeBasis: 'fullCapacity',
});
const costOf = (meal: Meal, perNight = true) =>
  purchaseTotals({ nights: 3, perNight, lines: FIVE_DOUBLE, meal }, 2);

describe('purchaseTotals', () => {
  it('multiplies by nights only when the rate is per night', () => {
    expect(costOf({ pricing: 'none' }).roomCost).toBe('1500.00');
    expect(costOf({ pricing: 'none' }, false).roomCost).toBe('500.00');
  });

  it('counts room-nights either way', () => {
    expect(costOf({ pricing: 'none' }, false).roomNights).toBe(15);
  });

  it('costs a meal by each basis (5 Double, 3 nights, SAR 50)', () => {
    expect(costOf(separate('perPersonPerNight')).mealCost).toBe('1500.00');
    expect(costOf(separate('perRoomPerNight')).mealCost).toBe('750.00');
    expect(costOf(separate('perPersonPerStay')).mealCost).toBe('500.00');
  });

  it('adds nothing for a meal that is none or included', () => {
    expect(costOf({ pricing: 'none' }).total).toBe('1500.00');
    expect(costOf({ pricing: 'included' }).total).toBe('1500.00');
  });

  it('keeps guests-sold meals out of the total, and reports the most they can reach', () => {
    const totals = costOf({
      pricing: 'separate',
      rate: '50',
      basis: 'perPersonPerNight',
      chargeBasis: 'guestsSold',
    });

    expect(totals.mealCost).toBe('0.00');
    expect(totals.mealMaximum).toBe('1500.00');
    expect(totals.total).toBe('1500.00');
  });

  it('adds without float drift, rounding once per line', () => {
    const totals = purchaseTotals(
      {
        nights: 1,
        perNight: true,
        lines: [
          { rooms: 1, rate: '0.1', personsPerRoom: 2 },
          { rooms: 1, rate: '0.2', personsPerRoom: 2 },
        ],
        meal: { pricing: 'none' },
      },
      2,
    );

    expect(totals.total).toBe('0.30');
  });

  it('adds several lines with distinct rates', () => {
    const totals = purchaseTotals(
      {
        nights: 2,
        perNight: true,
        lines: [
          { rooms: 2, rate: '500', personsPerRoom: 2 },
          { rooms: 1, rate: '650', personsPerRoom: 3 },
        ],
        meal: { pricing: 'none' },
      },
      2,
    );

    expect(totals.lineCosts).toEqual(['2000.00', '1300.00']);
    expect(totals.total).toBe('3300.00');
  });
});

describe('referenceRate', () => {
  const hotel = { doubleRate: '400', extraBedRate: '50', flatRate: '300' };

  it('adds an extra bed for each guest above two', () => {
    expect(referenceRate(hotel, 2)).toBe('400');
    expect(referenceRate(hotel, 3)).toBe('450');
    expect(referenceRate(hotel, 4)).toBe('500');
  });

  it('falls back to the flat rate, or nothing', () => {
    expect(referenceRate({ flatRate: '300' }, 3)).toBe('300');
    expect(referenceRate({ doubleRate: '400' }, 3)).toBe('');
    expect(referenceRate({}, 2)).toBe('');
  });
});

describe('the sample purchases', () => {
  it.each(seed.map((record) => [record.number, record] as const))(
    '%s has correct frozen figures',
    (_, record) => {
      const purchase = purchaseSchema.parse(record);
      const totals = purchaseTotals(
        {
          nights: nightsBetween(purchase.checkIn, purchase.checkOut),
          perNight: purchase.perNight,
          lines: purchase.lines,
          meal: purchase.meal,
        },
        2,
      );
      const frozen = (amount: string) => moneyLine(amount, purchase.currencyCode, purchase.rateToPkr);

      expect(purchase.lines.map((line) => line.cost)).toEqual(totals.lineCosts.map(frozen));
      expect(purchase.roomCost).toEqual(frozen(totals.roomCost));
      expect(purchase.mealCost).toEqual(frozen(totals.mealCost));
      expect(purchase.total).toEqual(frozen(totals.total));
    },
  );
});
