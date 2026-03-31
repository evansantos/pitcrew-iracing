/**
 * Shared types for the iRacing Telemetry Relay Server
 */

// ─── Telemetry data types ────────────────────────────────────────────────────

export interface TireCorner {
  temp: number; // Celsius
  wear: number; // 0–1
  pressure: number; // kPa
}

export interface TireData {
  lf: TireCorner;
  rf: TireCorner;
  lr: TireCorner;
  rr: TireCorner;
}

export interface PlayerData {
  speed: number; // km/h
  rpm: number;
  gear: number;
  throttle: number; // 0–1
  brake: number; // 0–1
  lap: number;
  lapDistPct: number; // 0–1
  currentLapTime: number; // seconds
  lastLapTime: number; // seconds
  bestLapTime: number; // seconds
  position: number;
  classPosition: number;
}

export interface FuelData {
  level: number; // litres
  levelPct: number; // 0–100
  usePerHour: number; // litres/hour
  lapsRemaining: number;
}

export interface TrackData {
  temperature: number; // Celsius
  airTemp: number; // Celsius
  windSpeed: number; // m/s
  windDirection: number; // radians
  humidity: number; // 0–100
}

export interface SessionData {
  state: number;
  flags: number;
  timeRemaining: number; // seconds
  lapsRemaining: number;
}

export interface TelemetryFrame {
  timestamp: number; // ms epoch
  sessionTime: number; // seconds
  player: PlayerData;
  fuel: FuelData;
  tires: TireData;
  track: TrackData;
  session: SessionData;
}

// ─── Wire message types ──────────────────────────────────────────────────────

export type WireMessageType =
  | 'handshake'
  | 'handshake_ack'
  | 'subscribe'
  | 'telemetry'
  | 'session'
  | 'error';

export interface HandshakeMessage {
  type: 'handshake';
  version: string;
}

export interface HandshakeAckMessage {
  type: 'handshake_ack';
  version: string;
  mockMode: boolean;
}

export interface SubscribeMessage {
  type: 'subscribe';
  channels: string[];
}

export interface TelemetryMessage {
  type: 'telemetry';
  data: DeltaFrame;
}

export interface SessionMessage {
  type: 'session';
  data: { state: string; sessionInfo?: unknown };
}

export interface ErrorMessage {
  type: 'error';
  error: string;
}

export type InboundMessage = HandshakeMessage | SubscribeMessage;
export type OutboundMessage =
  | HandshakeAckMessage
  | TelemetryMessage
  | SessionMessage
  | ErrorMessage;

// ─── Delta encoding ──────────────────────────────────────────────────────────

/**
 * A delta frame only carries fields that changed by ≥ threshold (0.1%).
 * Nested objects use the same key paths flattened with dots, but we keep them
 * nested for readability on the wire.
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type DeltaFrame = DeepPartial<TelemetryFrame> & {
  timestamp: number;
};

// ─── Server config ───────────────────────────────────────────────────────────

export interface RelayConfig {
  port: number;
  rate: number; // Hz
  compress: boolean;
  mock: boolean;
}

// ─── iRacing raw SDK shape (minimal typing) ──────────────────────────────────

export interface IRacingRawTelemetry {
  SessionTime?: number;
  Speed?: number;
  RPM?: number;
  Gear?: number;
  Throttle?: number;
  Brake?: number;
  Lap?: number;
  LapDistPct?: number;
  LapCurrentLapTime?: number;
  LapLastLapTime?: number;
  LapBestLapTime?: number;
  Position?: number;
  ClassPosition?: number;
  FuelLevel?: number;
  FuelLevelPct?: number;
  FuelUsePerHour?: number;
  LFtempCM?: number;
  LFwearM?: number;
  LFpressure?: number;
  RFtempCM?: number;
  RFwearM?: number;
  RFpressure?: number;
  LRtempCM?: number;
  LRwearM?: number;
  LRpressure?: number;
  RRtempCM?: number;
  RRwearM?: number;
  RRpressure?: number;
  TrackTemp?: number;
  AirTemp?: number;
  WindVel?: number;
  WindDir?: number;
  RelativeHumidity?: number;
  SessionState?: number;
  SessionFlags?: number;
  SessionTimeRemain?: number;
  SessionLapsRemain?: number;
}

export interface IRacingSessionInfo {
  WeekendInfo?: {
    TrackName?: string;
    TrackCity?: string;
    TrackCountry?: string;
  };
  DriverInfo?: {
    Drivers?: Array<{
      CarIdx?: number;
      UserName?: string;
      CarScreenName?: string;
    }>;
  };
}

// ─── Display state ───────────────────────────────────────────────────────────

export interface DisplayState {
  connected: boolean;
  mockMode: boolean;
  clientCount: number;
  bytesSent: number;
  frameCount: number;
  track: string;
  car: string;
  telemetry: TelemetryFrame | null;
}
