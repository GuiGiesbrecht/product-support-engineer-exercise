import { describe, it, expect } from 'vitest';
import { monthToDateRange, addDays, eachDay, assertIsoDate } from '@metris/shared';

describe('date helpers', () => {
  it('builds a month-to-date range from an anchor date', () => {
    expect(monthToDateRange('2026-07-29')).toEqual({ from: '2026-07-01', to: '2026-07-29' });
    expect(monthToDateRange('2026-01-01')).toEqual({ from: '2026-01-01', to: '2026-01-01' });
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-07-29', 3)).toBe('2026-08-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('enumerates civil days inclusively', () => {
    expect(eachDay('2026-07-27', '2026-07-29')).toEqual(['2026-07-27', '2026-07-28', '2026-07-29']);
  });

  it('rejects values that are not ISO dates', () => {
    expect(() => assertIsoDate('29/07/2026')).toThrow();
    expect(() => assertIsoDate('2026-07-29T00:00:00Z')).toThrow();
  });
});
