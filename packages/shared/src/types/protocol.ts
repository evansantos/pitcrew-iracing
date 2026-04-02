/**
 * WebSocket Protocol v2 — shared types between relay server and clients
 *
 * Message envelope: { type, version, payload, timestamp, sessionId? }
 * Protocol negotiation on connect, heartbeat with latency, backward compat with v1.
 */

// ─── Protocol versions ──────────────────────────────────────────────────────

export const PROTOCOL_V1 = '1.0' as const;
export const PROTOCOL_V2 = '2.0' as const;
export type ProtocolVersion = typeof PROTOCOL_V1 | typeof PROTOCOL_V2;

// ─── v2 Message Envelope ────────────────────────────────────────────────────

export interface ProtocolEnvelope<T extends string = string, P = unknown> {
  /** Message type discriminator */
  type: T;
  /** Protocol version */
  version: ProtocolVersion;
  /** Message payload */
  payload: P;
  /** Timestamp when the message was created (ms epoch) */
  timestamp: number;
  /** Session identifier (optional, for session-scoped messages) */
  sessionId?: string;
}

// ─── Handshake ──────────────────────────────────────────────────────────────

export interface HandshakePayload {
  /** Client's requested protocol version */
  requestedVersion: ProtocolVersion;
  /** Client identifier */
  clientId?: string;
  /** Supported encoding formats */
  encoding?: ('json' | 'msgpack')[];
}

export interface HandshakeAckPayload {
  /** Negotiated protocol version */
  negotiatedVersion: ProtocolVersion;
  /** Server is in mock mode */
  mockMode: boolean;
  /** Negotiated encoding format */
  encoding: 'json' | 'msgpack';
  /** Server uptime in seconds */
  serverUptime: number;
}

export type HandshakeMessage = ProtocolEnvelope<'handshake', HandshakePayload>;
export type HandshakeAckMessage = ProtocolEnvelope<'handshake_ack', HandshakeAckPayload>;

// ─── Heartbeat / Ping-Pong ──────────────────────────────────────────────────

export interface PingPayload {
  /** Sequence number for matching pong responses */
  seq: number;
}

export interface PongPayload {
  /** Matching sequence number from ping */
  seq: number;
  /** Server timestamp when pong was sent */
  serverTime: number;
}

export type PingMessage = ProtocolEnvelope<'ping', PingPayload>;
export type PongMessage = ProtocolEnvelope<'pong', PongPayload>;

// ─── Subscribe ──────────────────────────────────────────────────────────────

export interface SubscribePayload {
  channels: string[];
}

export type SubscribeMessage = ProtocolEnvelope<'subscribe', SubscribePayload>;

// ─── Telemetry ──────────────────────────────────────────────────────────────

export interface TelemetryPayload {
  /** Delta-encoded telemetry frame */
  data: Record<string, unknown>;
  /** Frame sequence number */
  frameSeq: number;
  /** Whether this is a full frame (not delta) */
  isKeyFrame: boolean;
}

export type TelemetryMessage = ProtocolEnvelope<'telemetry', TelemetryPayload>;

// ─── Session ────────────────────────────────────────────────────────────────

export interface SessionPayload {
  state: string;
  sessionInfo?: Record<string, unknown>;
}

export type SessionMessage = ProtocolEnvelope<'session', SessionPayload>;

// ─── Error ──────────────────────────────────────────────────────────────────

export interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export type ErrorMessage = ProtocolEnvelope<'error', ErrorPayload>;

// ─── Stats (relay metrics) ──────────────────────────────────────────────────

export interface StatsPayload {
  clientCount: number;
  bytesSent: number;
  frameCount: number;
  latency: {
    min: number;
    avg: number;
    max: number;
  };
  uptime: number;
}

export type StatsMessage = ProtocolEnvelope<'stats', StatsPayload>;

// ─── Union types for inbound/outbound ────────────────────────────────────────

export type V2InboundMessage =
  | HandshakeMessage
  | SubscribeMessage
  | PingMessage;

export type V2OutboundMessage =
  | HandshakeAckMessage
  | TelemetryMessage
  | SessionMessage
  | ErrorMessage
  | PongMessage
  | StatsMessage;

export type V2Message = V2InboundMessage | V2OutboundMessage;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Create a v2 protocol envelope */
export function createEnvelope<T extends string, P>(
  type: T,
  payload: P,
  sessionId?: string,
): ProtocolEnvelope<T, P> {
  return {
    type,
    version: PROTOCOL_V2,
    payload,
    timestamp: Date.now(),
    sessionId,
  };
}

/** Check if a message is a v2 envelope (has version field) */
export function isV2Message(msg: unknown): msg is ProtocolEnvelope {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'version' in msg &&
    'payload' in msg &&
    'type' in msg
  );
}

/** Check if a message is a v1-style message (has type but no version/payload) */
export function isV1Message(msg: unknown): boolean {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    !('version' in msg)
  );
}
