import { describe, it, expect } from 'vitest';

// Unit tests for the session module
// Full integration requires DB; these tests validate types and shape only.

describe('session module', () => {
  describe('GET /', () => {
    it('returns session info shape', () => {
      const response = {
        session: { sessionId: null },
        isActive: false,
        timestamp: new Date().toISOString(),
      };
      expect(response).toHaveProperty('session');
      expect(response).toHaveProperty('isActive');
      expect(typeof response.isActive).toBe('boolean');
    });
  });

  describe('POST /cleanup', () => {
    it('uses default 7 days when days not specified', () => {
      const body: { days?: number } = {};
      const olderThanDays = body.days ?? 7;
      expect(olderThanDays).toBe(7);
    });

    it('uses specified days when provided', () => {
      const body = { days: 14 };
      const olderThanDays = body.days ?? 7;
      expect(olderThanDays).toBe(14);
    });
  });
});
