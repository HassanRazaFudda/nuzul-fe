import { describe, expect, it } from 'vitest';

import {
  agreementDocument,
  amountWords,
  ordinal,
  periodDay,
  seasonLine,
  type AgreementContract,
} from './agreement';

const months = [
  { id: 'm', cycle: '1448', ordinal: 12, name: 'Zul-Hijjah', days: 30, startDate: '2027-05-08' },
];
const SHORT: Record<string, string> = { double: 'DBL', triple: 'TRPL', quad: 'QUAD' };
const context = {
  months,
  seasonWord: 'HAJJ',
  shortName: (id: string) => SHORT[id] ?? id.toUpperCase(),
};

const contract = (overrides: Partial<AgreementContract> = {}): AgreementContract => ({
  date: '2026-08-29',
  currencyCode: 'SAR',
  mealPlan: { kind: 'perNightPerPerson', rate: '75' },
  hotels: [
    {
      hotelName: 'Artal International',
      checkIn: '2027-05-08',
      checkOut: '2027-05-12',
      perNight: true,
      noMeals: false,
      lines: [
        { soldAsTypeId: 'double', rooms: 2, rate: '600' },
        { soldAsTypeId: 'triple', rooms: 2, rate: '600' },
        { soldAsTypeId: 'quad', rooms: 5, rate: '600' },
      ],
      total: { amount: '21600.00' },
    },
  ],
  total: { amount: '21600.00' },
  ...overrides,
});

describe('wording', () => {
  it('writes ordinals and amounts as the agreement does', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 29].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '29th',
    ]);
    expect(amountWords('90000.00')).toBe('90,000');
    expect(amountWords('1250.5')).toBe('1,250.50');
  });

  it('names days by the calendar, and falls back to the English date', () => {
    expect(periodDay('2027-05-08', months)).toBe('01 ZUL-HIJJAH');
    expect(periodDay('2027-05-12', months)).toBe('05 ZUL-HIJJAH');
    expect(periodDay('2027-09-01', months)).toBe('01 SEPTEMBER 2027');
  });

  it('takes the season year from the calendar', () => {
    expect(seasonLine('HAJJ', '2027-05-08', months)).toBe('HAJJ 1448 H / 2027');
    expect(seasonLine('HAJJ', '2027-09-01', months)).toBe('HAJJ 2027');
  });
});

describe('agreementDocument', () => {
  it('fills the table as in the owner format', () => {
    const document = agreementDocument(contract(), context);

    expect(document).toMatchObject({
      season: 'HAJJ 1448 H / 2027',
      dayOrdinal: '29th',
      monthYear: 'August, 2026',
      grandTotal: '21,600 SAR',
      mealPlan: '[ PER NIGHT PER PERSON 75 SR ]',
    });
    expect(document.rows).toEqual([
      {
        hotel: 'ARTAL INTERNATIONAL',
        from: '01 ZUL-HIJJAH',
        to: '05 ZUL-HIJJAH',
        rooms: ['02 DBL', '02 TRPL', '05 QUAD'],
        rateLabel: 'ROOM RATE :',
        rates: ['600 SAR'],
        rateBasis: 'per night',
        total: '21,600/-SR',
      },
    ]);
  });

  it('lists a rate per room type when they differ', () => {
    const [hotel] = contract().hotels;
    if (!hotel) throw new Error('expected a hotel');
    const document = agreementDocument(
      contract({
        hotels: [
          {
            ...hotel,
            lines: [
              { soldAsTypeId: 'double', rooms: 2, rate: '600' },
              { soldAsTypeId: 'triple', rooms: 1, rate: '700' },
            ],
          },
        ],
      }),
      context,
    );

    expect(document.rows[0]?.rates).toEqual(['DBL 600 SAR', 'TRPL 700 SAR']);
  });

  it('names hotels without meals, and says when there is no plan', () => {
    const [hotel] = contract().hotels;
    if (!hotel) throw new Error('expected a hotel');

    expect(agreementDocument(contract({ hotels: [{ ...hotel, noMeals: true }] }), context).mealPlan).toBe(
      '[ PER NIGHT PER PERSON 75 SR ], not at ARTAL INTERNATIONAL',
    );
    expect(agreementDocument(contract({ mealPlan: { kind: 'none' } }), context).mealPlan).toBe(
      'No meal plan',
    );
  });
});
