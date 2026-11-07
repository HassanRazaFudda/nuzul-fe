import { describe, expect, it } from 'vitest';

import {
  conversionPairs,
  conversionRuleId,
  isConversionAllowed,
  type ConversionRule,
  type RoomType,
} from './conversion';

const types: RoomType[] = [
  { id: 'double', name: 'Double', capacity: 2 },
  { id: 'quad', name: 'Quad', capacity: 4 },
  { id: 'triple', name: 'Triple', capacity: 3 },
];

const rule = (hotelId: string | null, source: string, soldAs: string, allowed: boolean) =>
  ({
    id: conversionRuleId(hotelId, source, soldAs),
    hotelId,
    sourceTypeId: source,
    soldAsTypeId: soldAs,
    allowed,
  }) satisfies ConversionRule;

describe('conversion pairs', () => {
  it('lists downward pairs only, largest source first', () => {
    expect(conversionPairs(types).map((p) => `${p.source.id}>${p.soldAs.id}`)).toEqual([
      'quad>triple',
      'quad>double',
      'triple>double',
    ]);
  });

  it('picks up a new room type with no code change', () => {
    const pairs = conversionPairs([...types, { id: 'quint', name: 'Quint', capacity: 5 }]);
    expect(pairs).toHaveLength(6);
    expect(pairs[0]?.source.id).toBe('quint');
  });
});

describe('is a conversion allowed?', () => {
  const allowed = (rules: ConversionRule[], source: string, soldAs: string) =>
    isConversionAllowed(rules, types, 'hotel-1', source, soldAs);

  it('is off by default', () => {
    expect(allowed([], 'quad', 'double')).toBe(false);
  });

  it('always allows the same type, conversion or not', () => {
    expect(allowed([], 'quad', 'quad')).toBe(true);
  });

  it('follows the system default', () => {
    expect(allowed([rule(null, 'quad', 'double', true)], 'quad', 'double')).toBe(true);
  });

  it('lets a hotel override the default, in both directions', () => {
    expect(
      allowed(
        [rule(null, 'quad', 'double', true), rule('hotel-1', 'quad', 'double', false)],
        'quad',
        'double',
      ),
    ).toBe(false);
    expect(
      allowed(
        [rule(null, 'quad', 'double', false), rule('hotel-1', 'quad', 'double', true)],
        'quad',
        'double',
      ),
    ).toBe(true);
  });

  it('ignores a rule for another hotel', () => {
    expect(allowed([rule('hotel-2', 'quad', 'double', true)], 'quad', 'double')).toBe(false);
  });

  it('never goes upward, even if a rule says so', () => {
    expect(allowed([rule(null, 'double', 'quad', true)], 'double', 'quad')).toBe(false);
  });

  it('refuses an unknown room type', () => {
    expect(allowed([], 'quad', 'nope')).toBe(false);
  });
});
