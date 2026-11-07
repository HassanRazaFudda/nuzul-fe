import { describe, expect, it } from 'vitest';

import {
  dec,
  formatMoney,
  lineInCurrency,
  moneyLine,
  rateOn,
  roundTo,
  sum,
  weightedAverage,
  type ExchangeRate,
} from './money';

const SAR = { symbol: 'SAR', decimals: 2 };

describe('exact arithmetic', () => {
  it('has no floating-point drift', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sum(['0.1', '0.2'])).toBe('0.3');
  });

  it('rounds half-up, once', () => {
    expect(roundTo('1.005', 2)).toBe('1.01');
    expect(roundTo('2.5', 0)).toBe('3');
    expect(roundTo('-1.005', 2)).toBe('-1.01');
  });
});

describe('weighted average cost', () => {
  it('reproduces the two worked examples', () => {
    const one = weightedAverage([
      { cost: '1000', roomNights: 10 },
      { cost: '2000', roomNights: 10 },
    ]);
    expect(one?.toFixed(2)).toBe('150.00');

    const two = weightedAverage([
      { cost: '1000', roomNights: 10 },
      { cost: '1000', roomNights: 5 },
    ]);
    expect(two?.toFixed(2)).toBe('133.33');
  });

  it('is not the simple average of rates', () => {
    const rates = dec(100).plus(200).dividedBy(2).toFixed(2); // 150
    const weighted = weightedAverage([
      { cost: '1000', roomNights: 10 },
      { cost: '1000', roomNights: 5 },
    ]);
    expect(weighted?.toFixed(2)).not.toBe(rates);
  });

  it('has no average without room-nights: cost is unknown, not zero', () => {
    expect(weightedAverage([])).toBeNull();
  });
});

describe('exchange rates', () => {
  const history: ExchangeRate[] = [
    { id: '1', currencyCode: 'SAR', rateToPkr: '70', effectiveFrom: '2026-01-01' },
    { id: '2', currencyCode: 'SAR', rateToPkr: '72', effectiveFrom: '2026-06-01' },
    { id: '3', currencyCode: 'USD', rateToPkr: '280', effectiveFrom: '2026-01-01' },
  ];

  it('finds the rate in force on a date', () => {
    expect(rateOn(history, 'SAR', '2026-03-01')?.rateToPkr).toBe('70');
    expect(rateOn(history, 'SAR', '2026-06-01')?.rateToPkr).toBe('72');
    expect(rateOn(history, 'SAR', '2025-12-31')).toBeNull();
  });

  it('keeps a past line at its own rate after the rate changes', () => {
    const purchase = moneyLine('1000', 'SAR', '70');
    const sale = moneyLine('1500', 'SAR', '72');
    expect(purchase.amountPkr).toBe('70000.00');
    expect(sale.amountPkr).toBe('108000.00');
    // Transaction-date view: 108,000 - 70,000 = 38,000.
    expect(dec(sale.amountPkr).minus(purchase.amountPkr).toFixed(2)).toBe('38000.00');
    // Revaluation at 72 is a separate view: cost 72,000, profit 36,000.
    expect(dec(sale.amountPkr).minus(dec(purchase.amount).times(72)).toFixed(2)).toBe('36000.00');
  });

  it('converts a stored line to a reporting currency', () => {
    expect(lineInCurrency(moneyLine('1000', 'SAR', '70'), '280', 2)).toBe('250.00');
  });
});

describe('display', () => {
  it('groups thousands and keeps the sign', () => {
    expect(formatMoney('1234.5', SAR)).toBe('SAR 1,234.50');
    expect(formatMoney('-1000000', { symbol: 'PKR', decimals: 0 })).toBe('-PKR 1,000,000');
  });
});
