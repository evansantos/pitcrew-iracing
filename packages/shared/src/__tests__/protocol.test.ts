import { describe, it, expect } from 'vitest';
import {
  createEnvelope,
  isV2Message,
  isV1Message,
  PROTOCOL_V2,
} from '../types/protocol';

describe('Protocol v2', () => {
  describe('createEnvelope', () => {
    it('creates a valid v2 envelope with required fields', () => {
      const envelope = createEnvelope('handshake', { requestedVersion: '2.0' as const });

      expect(envelope.type).toBe('handshake');
      expect(envelope.version).toBe(PROTOCOL_V2);
      expect(envelope.payload).toEqual({ requestedVersion: '2.0' });
      expect(typeof envelope.timestamp).toBe('number');
      expect(envelope.sessionId).toBeUndefined();
    });

    it('includes sessionId when provided', () => {
      const envelope = createEnvelope('telemetry', { data: {} }, 'session-123');

      expect(envelope.sessionId).toBe('session-123');
    });
  });

  describe('isV2Message', () => {
    it('returns true for v2 messages with version and payload', () => {
      const msg = createEnvelope('ping', { seq: 1 });
      expect(isV2Message(msg)).toBe(true);
    });

    it('returns false for v1-style messages', () => {
      const v1Msg = { type: 'handshake', version: '1.0' };
      // v1 messages don't have payload
      expect(isV2Message(v1Msg)).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isV2Message(null)).toBe(false);
      expect(isV2Message(undefined)).toBe(false);
      expect(isV2Message('string')).toBe(false);
    });
  });

  describe('isV1Message', () => {
    it('returns true for v1 messages (type, no version)', () => {
      const v1Msg = { type: 'handshake', data: {} };
      expect(isV1Message(v1Msg)).toBe(true);
    });

    it('returns false for v2 messages', () => {
      const v2Msg = { type: 'handshake', version: '2.0', payload: {} };
      expect(isV1Message(v2Msg)).toBe(false);
    });

    it('returns false for non-objects', () => {
      expect(isV1Message(null)).toBe(false);
      expect(isV1Message(42)).toBe(false);
    });
  });

  describe('message type round-trip', () => {
    it('handshake serializes and deserializes', () => {
      const msg = createEnvelope('handshake', {
        requestedVersion: '2.0' as const,
        encoding: ['json'] as const,
      });

      const serialized = JSON.stringify(msg);
      const parsed = JSON.parse(serialized);

      expect(isV2Message(parsed)).toBe(true);
      expect(parsed.type).toBe('handshake');
      expect(parsed.payload.requestedVersion).toBe('2.0');
    });

    it('ping/pong round-trip preserves seq', () => {
      const ping = createEnvelope('ping', { seq: 42 });
      const pong = createEnvelope('pong', { seq: 42, serverTime: Date.now() });

      expect(ping.payload.seq).toBe(pong.payload.seq);
    });

    it('error envelope carries code and message', () => {
      const error = createEnvelope('error', {
        code: 'INVALID_VERSION',
        message: 'Unsupported protocol version',
      });

      expect(error.payload.code).toBe('INVALID_VERSION');
      expect(error.payload.message).toBe('Unsupported protocol version');
    });
  });
});
