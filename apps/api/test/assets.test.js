import { describe, it, expect } from 'vitest';
import { isOffline } from '@metris/shared';

describe('isOffline', () => {
  const reference = '2026-07-28T12:15:00Z';

  it('flags connectors quiet for longer than the threshold', () => {
    expect(isOffline('2026-07-28T06:12:44Z', reference)).toBe(true);
  });

  it('keeps recently seen connectors online', () => {
    expect(isOffline('2026-07-28T09:00:00Z', reference)).toBe(false);
  });

  it('treats connectors that never reported as offline', () => {
    expect(isOffline(null, reference)).toBe(true);
  });

  it('honours a custom threshold', () => {
    expect(isOffline('2026-07-28T09:00:00Z', reference, 2)).toBe(true);
  });
});
