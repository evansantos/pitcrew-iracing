/**
 * Session and race management types
 */

export interface RaceSession {
  sessionId: string;
  sessionType: SessionType;
  trackName: string;
  trackId: number;
  trackLength: number;
  startTime: Date;
  endTime?: Date;
  duration: number;
  laps: number;
  multiClass: boolean;
  classes: string[];
}

export enum SessionType {
  Practice = 'practice',
  Qualifying = 'qualifying',
  Race = 'race',
  TimeTrial = 'time_trial',
  LoneQualifying = 'lone_qualifying',
}

export interface SessionResult {
  sessionId: string;
  finishPosition: number;
  startPosition: number;
  lapsCompleted: number;
  fastestLap: number;
  averageLapTime: number;
  incidents: number;
  lapTimes: number[];
  pitStops: PitStopData[];
}

export interface PitStopData {
  lap: number;
  sessionTime: number;
  duration: number;
  pitInTime: number;
  pitOutTime: number;
  reason: PitStopReason;
  fuelAdded?: number;
  tiresChanged?: boolean;
  repairsNeeded?: string[];
}

export enum PitStopReason {
  Fuel = 'fuel',
  Tires = 'tires',
  Damage = 'damage',
  Strategy = 'strategy',
  Emergency = 'emergency',
}

export interface RaceEvent {
  id: string;
  type: RaceEventType;
  timestamp: number;
  sessionTime: number;
  lap: number;
  data: Record<string, any>;
}

export enum RaceEventType {
  SessionStart = 'session_start',
  SessionEnd = 'session_end',
  FlagChange = 'flag_change',
  PitEntry = 'pit_entry',
  PitExit = 'pit_exit',
  Incident = 'incident',
  FastestLap = 'fastest_lap',
  PositionChange = 'position_change',
  DriverJoin = 'driver_join',
  DriverLeave = 'driver_leave',
}
