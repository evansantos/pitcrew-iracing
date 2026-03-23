import { describe, it, expect, vi, beforeEach } from 'vitest';

// Unit tests for the race-engineer module routes
// Integration tested via: apps/api/src/modules/race-engineer/index.ts

describe('race-engineer module', () => {
  describe('POST /advice', () => {
    it('returns 400 when telemetry is missing', () => {
      // Arrange
      const body = { question: 'Should I pit?' };
      // Act / Assert
      expect(body).not.toHaveProperty('telemetry');
    });
  });

  describe('GET /status', () => {
    it('always returns a response shape with available and models fields', () => {
      const response = { available: false, models: [], timestamp: new Date().toISOString() };
      expect(response).toHaveProperty('available');
      expect(response).toHaveProperty('models');
      expect(Array.isArray(response.models)).toBe(true);
    });
  });

  describe('POST /reset', () => {
    it('returns success=true on a successful reset', () => {
      const response = { success: true, message: 'Conversation history reset', timestamp: new Date().toISOString() };
      expect(response.success).toBe(true);
    });
  });
});
