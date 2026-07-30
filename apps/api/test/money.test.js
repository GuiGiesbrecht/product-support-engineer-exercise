import { describe, it, expect } from 'vitest';
import { formatGBP, toPence, fromPence, roundMoney } from '@metris/shared';

describe('money helpers', () => {
  it('formats GBP with thousands separators', () => {
    expect(formatGBP(4321)).toBe('£4,321.00');
    expect(formatGBP(4087.5)).toBe('£4,087.50');
  });

  it('supports whole-pound formatting for KPI tiles', () => {
    expect(formatGBP(4321, { decimals: 0 })).toBe('£4,321');
  });

  it('round-trips pence without floating point drift', () => {
    expect(toPence(19.99)).toBe(1999);
    expect(fromPence(toPence(0.1) + toPence(0.2))).toBe(0.3);
  });

  it('rounds to the penny', () => {
    expect(roundMoney(129.955)).toBe(129.96);
    expect(roundMoney(129.954)).toBe(129.95);
  });
});
