import { describe, it, expect } from 'vitest';
import { activeAgreementFor } from '@metris/shared';

const agreements = [
  {
    counterparty: 'Example Ltd',
    rate_per_kwh: 0.08,
    start_date: '2025-01-01',
    end_date: '2026-06-30',
    status: 'superseded',
  },
  {
    counterparty: 'Example Ltd',
    rate_per_kwh: 0.08,
    start_date: '2026-07-01',
    end_date: '2031-06-30',
    status: 'active',
  },
];

describe('activeAgreementFor', () => {
  it('selects the agreement whose window contains the date', () => {
    const agreement = activeAgreementFor(agreements, '2026-07-15');
    expect(agreement).not.toBeNull();
    expect(agreement.start_date).toBe('2026-07-01');
  });

  it('ignores agreements that are not active', () => {
    expect(activeAgreementFor(agreements, '2026-06-15')).toBeNull();
  });

  it('returns null when no agreement covers the date', () => {
    expect(activeAgreementFor([agreements[0]], '2026-07-15')).toBeNull();
    expect(activeAgreementFor([], '2026-07-15')).toBeNull();
  });
});
