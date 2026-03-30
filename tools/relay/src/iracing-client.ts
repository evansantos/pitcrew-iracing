/**
 * iRacing SDK wrapper with typed events.
 *
 * On Windows: wraps the real `node-irsdk` package.
 * On macOS/Linux (or when --mock is set): emits synthesised telemetry.
 */

import { EventEmitter } from 'node:events';
import type { TelemetryFrame, IRacingRawTelemetry, IRacingSessionInfo } from './types.js';

// ─── Typed event map ──────────────────────────────────────────────────────────

export interface IRacingClientEvents {
  connected: [];
  disconnected: [];
  telemetry: [frame: TelemetryFrame];
  sessionInfo: [info: IRacingSessionInfo];
  error: [err: Error];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function transformTelemetry(data: IRacingRawTelemetry): TelemetryFrame {
  const fuelLevel = data.FuelLevel ?? 0;
  const fuelUsePerHour = data.FuelUsePerHour ?? 1;

  return {
    timestamp: Date.now(),
    sessionTime: data.SessionTime ?? 0,

    player: {
      speed: data.Speed != null ? data.Speed * 3.6 : 0, // m/s → km/h
      rpm: data.RPM ?? 0,
      gear: data.Gear ?? 0,
      throttle: data.Throttle ?? 0,
      brake: data.Brake ?? 0,
      lap: data.Lap ?? 0,
      lapDistPct: data.LapDistPct ?? 0,
      currentLapTime: data.LapCurrentLapTime ?? 0,
      lastLapTime: data.LapLastLapTime ?? 0,
      bestLapTime: data.LapBestLapTime ?? 0,
      position: data.Position ?? 0,
      classPosition: data.ClassPosition ?? 0,
    },

    fuel: {
      level: fuelLevel,
      levelPct: data.FuelLevelPct != null ? data.FuelLevelPct * 100 : 0,
      usePerHour: fuelUsePerHour,
      lapsRemaining: fuelUsePerHour > 0
        ? Math.floor(fuelLevel / (fuelUsePerHour / 60))
        : 0,
    },

    tires: {
      lf: {
        temp: data.LFtempCM ?? 0,
        wear: data.LFwearM ?? 0,
        pressure: data.LFpressure ?? 0,
      },
      rf: {
        temp: data.RFtempCM ?? 0,
        wear: data.RFwearM ?? 0,
        pressure: data.RFpressure ?? 0,
      },
      lr: {
        temp: data.LRtempCM ?? 0,
        wear: data.LRwearM ?? 0,
        pressure: data.LRpressure ?? 0,
      },
      rr: {
        temp: data.RRtempCM ?? 0,
        wear: data.RRwearM ?? 0,
        pressure: data.RRpressure ?? 0,
      },
    },

    track: {
      temperature: data.TrackTemp ?? 20,
      airTemp: data.AirTemp ?? 20,
      windSpeed: data.WindVel ?? 0,
      windDirection: data.WindDir ?? 0,
      humidity: data.RelativeHumidity != null ? data.RelativeHumidity * 100 : 50,
    },

    session: {
      state: data.SessionState ?? 0,
      flags: data.SessionFlags ?? 0,
      timeRemaining: data.SessionTimeRemain ?? 0,
      lapsRemaining: data.SessionLapsRemain ?? 0,
    },
  };
}

// ─── Base class ───────────────────────────────────────────────────────────────

export abstract class BaseIRacingClient extends EventEmitter {
  abstract start(): void;
  abstract stop(): void;

  // TypeScript typed emit/on wrappers
  override emit<K extends keyof IRacingClientEvents>(
    event: K,
    ...args: IRacingClientEvents[K]
  ): boolean {
    return super.emit(event, ...args);
  }

  override on<K extends keyof IRacingClientEvents>(
    event: K,
    listener: (...args: IRacingClientEvents[K]) => void
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }
}

// ─── Real iRacing client (Windows) ───────────────────────────────────────────

export class RealIRacingClient extends BaseIRacingClient {
  private iracing: unknown = null;
  private readonly rate: number;

  constructor(rate: number = 60) {
    super();
    this.rate = rate;
  }

  start(): void {
    let irsdk: {
      init: (opts: { telemetryUpdateInterval: number; sessionInfoUpdateInterval: number }) => {
        on: (event: string, cb: (...args: unknown[]) => void) => void;
      };
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      irsdk = require('node-irsdk') as typeof irsdk;
    } catch {
      this.emit(
        'error',
        new Error(
          'node-irsdk not available. Install Visual Studio Build Tools and run: npm install node-irsdk'
        )
      );
      return;
    }

    const ir = irsdk.init({
      telemetryUpdateInterval: Math.floor(1000 / this.rate),
      sessionInfoUpdateInterval: 1000,
    });
    this.iracing = ir;

    ir.on('Connected', () => this.emit('connected'));
    ir.on('Disconnected', () => this.emit('disconnected'));
    ir.on('Telemetry', (data: unknown) => {
      const frame = transformTelemetry(data as IRacingRawTelemetry);
      this.emit('telemetry', frame);
    });
    ir.on('SessionInfo', (info: unknown) => {
      this.emit('sessionInfo', info as IRacingSessionInfo);
    });
  }

  stop(): void {
    // node-irsdk doesn't expose a stop method; the process will clean up
    this.iracing = null;
  }
}

// ─── Mock client (macOS / CI) ─────────────────────────────────────────────────

interface MockState {
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  lap: number;
  lapDistPct: number;
  fuelLevel: number;
  tireTemp: number;
  sessionTime: number;
}

function jitter(value: number, maxDelta: number): number {
  return value + (Math.random() * 2 - 1) * maxDelta;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class MockIRacingClient extends BaseIRacingClient {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly rate: number;
  private readonly state: MockState = {
    speed: 120,
    rpm: 5500,
    gear: 4,
    throttle: 0.7,
    brake: 0,
    lap: 1,
    lapDistPct: 0,
    fuelLevel: 40,
    tireTemp: 85,
    sessionTime: 0,
  };

  constructor(rate: number = 10) {
    super();
    this.rate = rate;
  }

  start(): void {
    // Emit connected immediately
    process.nextTick(() => this.emit('connected'));

    // Emit session info
    process.nextTick(() => {
      this.emit('sessionInfo', {
        WeekendInfo: {
          TrackName: 'Sebring International Raceway',
          TrackCity: 'Sebring',
          TrackCountry: 'USA',
        },
        DriverInfo: {
          Drivers: [
            {
              CarIdx: 0,
              UserName: 'Mock Driver',
              CarScreenName: 'Porsche 911 GT3 R',
            },
          ],
        },
      });
    });

    const interval = Math.floor(1000 / this.rate);
    this.timer = setInterval(() => this.tick(), interval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    const s = this.state;
    const dt = 1 / this.rate;

    // Advance simulation
    s.sessionTime += dt;
    s.lapDistPct = (s.lapDistPct + 0.001 * (s.speed / 100)) % 1;
    if (s.lapDistPct < 0.002) {
      s.lap += 1;
    }

    // Jitter driving inputs
    s.speed = clamp(jitter(s.speed, 5), 50, 250);
    s.rpm = clamp(jitter(s.rpm, 200), 2000, 8500);
    s.throttle = clamp(jitter(s.throttle, 0.05), 0, 1);
    s.brake = clamp(s.throttle < 0.3 ? jitter(0.5, 0.2) : 0, 0, 1);
    s.gear = Math.round(clamp(s.speed / 50, 1, 6));
    s.fuelLevel = clamp(s.fuelLevel - 0.0001, 0, 80);
    s.tireTemp = clamp(jitter(s.tireTemp, 1), 60, 120);

    const frame = transformTelemetry({
      SessionTime: s.sessionTime,
      Speed: s.speed / 3.6,
      RPM: s.rpm,
      Gear: s.gear,
      Throttle: s.throttle,
      Brake: s.brake,
      Lap: s.lap,
      LapDistPct: s.lapDistPct,
      LapCurrentLapTime: (s.lapDistPct * 90) + 10,
      LapLastLapTime: 92.4,
      LapBestLapTime: 91.8,
      Position: 3,
      ClassPosition: 2,
      FuelLevel: s.fuelLevel,
      FuelLevelPct: s.fuelLevel / 80,
      FuelUsePerHour: 3.2,
      LFtempCM: s.tireTemp + jitter(0, 3),
      LFwearM: 0.1,
      LFpressure: 179,
      RFtempCM: s.tireTemp + jitter(0, 3),
      RFwearM: 0.12,
      RFpressure: 179,
      LRtempCM: s.tireTemp + jitter(0, 2),
      LRwearM: 0.08,
      LRpressure: 165,
      RRtempCM: s.tireTemp + jitter(0, 2),
      RRwearM: 0.09,
      RRpressure: 165,
      TrackTemp: 32,
      AirTemp: 28,
      WindVel: 2.5,
      WindDir: 1.2,
      RelativeHumidity: 0.55,
      SessionState: 4,
      SessionFlags: 0,
      SessionTimeRemain: 3600 - s.sessionTime,
      SessionLapsRemain: 30 - s.lap,
    });

    this.emit('telemetry', frame);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createIRacingClient(mock: boolean, rate: number): BaseIRacingClient {
  if (mock) {
    return new MockIRacingClient(rate);
  }
  return new RealIRacingClient(rate);
}
