/**
 * Core telemetry data types for iRacing SDK integration
 */

/**
 * Raw telemetry data from iRacing SDK
 */
export interface IRSDKTelemetry {
  // Session info
  SessionTime: number;
  SessionTick: number;
  SessionNum: number;
  SessionState: number;
  SessionFlags: number;

  // Player car data
  Speed: number;
  RPM: number;
  Gear: number;
  Throttle: number;
  Brake: number;
  Clutch: number;
  SteeringWheelAngle: number;

  // Position and lap data
  Lap: number;
  LapDist: number;
  LapDistPct: number;
  LapBestLap: number;
  LapBestLapTime: number;
  LapLastLapTime: number;
  LapCurrentLapTime: number;
  PlayerCarMyIncidentCount: number;

  // Fuel and tires
  FuelLevel: number;
  FuelLevelPct: number;
  FuelUsePerHour: number;
  LFtempCL: number;
  LFtempCM: number;
  LFtempCR: number;
  RFtempCL: number;
  RFtempCM: number;
  RFtempCR: number;
  LRtempCL: number;
  LRtempCM: number;
  LRtempCR: number;
  RRtempCL: number;
  RRtempCM: number;
  RRtempCR: number;

  // Tire wear
  LFwearL: number;
  LFwearM: number;
  LFwearR: number;
  RFwearL: number;
  RFwearM: number;
  RFwearR: number;
  LRwearL: number;
  LRwearM: number;
  LRwearR: number;
  RRwearL: number;
  RRwearM: number;
  RRwearR: number;

  // Track conditions
  TrackTemp: number;
  TrackTempCrew: number;
  AirTemp: number;
  AirPressure: number;
  WindVel: number;
  WindDir: number;
  RelativeHumidity: number;
  FogLevel: number;
  Skies: number;

  // Damage (optional - not all cars provide detailed damage)
  LFshockDefl?: number;
  RFshockDefl?: number;
  LRshockDefl?: number;
  RRshockDefl?: number;
  PlayerCarTowTime?: number;
  PlayerCarInPitStall?: boolean;

  // Car indices (all opponents)
  CarIdxLap: number[];
  CarIdxLapDistPct: number[];
  CarIdxTrackSurface: number[];
  CarIdxOnPitRoad: boolean[];
  CarIdxPitStopCount: number[];
  CarIdxLastLapTime: number[];
  CarIdxBestLapTime: number[];
  CarIdxBestLapNum: number[];
  CarIdxEstTime: number[];
  CarIdxF2Time: number[];
  CarIdxGear: number[];
  CarIdxRPM: number[];
  CarIdxClassPosition: number[];
  CarIdxPosition: number[];
}

/**
 * Processed telemetry data optimized for application use
 */
export interface ProcessedTelemetry {
  timestamp: number;
  sessionTime: number;

  // Player data
  player: {
    driverName: string;
    carName: string;
    speed: number;
    rpm: number;
    gear: number;
    throttle: number;
    brake: number;
    lap: number;
    lapDistPct: number;
    currentLapTime: number;
    lastLapTime: number;
    bestLapTime: number;
    position: number;
    classPosition: number;
    incidents: number;
    // Engine systems
    oilTemp: number;
    oilPress: number;
    waterTemp: number;
    waterLevel: number;
    voltage: number;
    engineWarnings: number;
    manifoldPress: number;
    // Push2Pass (IndyCar)
    push2PassStatus: boolean;
    push2PassCount: number;
    // Other
    dcBrakePct: number;
    clutch: number;
  };

  // Fuel data
  fuel: {
    level: number;
    levelPct: number;
    usePerHour: number;
    lapsRemaining: number;
    tankCapacity: number;
  };

  // Tire data
  tires: {
    lf: TireData;
    rf: TireData;
    lr: TireData;
    rr: TireData;
  };

  // Track conditions
  track: {
    name: string;
    temperature: number;
    airTemp: number;
    windSpeed: number;
    windDirection: number;
    humidity: number;
  };

  // Session info
  session: {
    state: SessionState;
    flags: SessionFlags;
    timeRemaining: number;
    lapsRemaining: number;
    type?: string;
    name?: string;
  };

  // Opponents data
  opponents?: OpponentData[];

  // Damage data (optional)
  damage?: {
    lf: number; // 0-1 scale (0 = no damage, 1 = destroyed)
    rf: number;
    lr: number;
    rr: number;
  };
}

export interface TireData {
  tempL: number;
  tempM: number;
  tempR: number;
  wearL: number;
  wearM: number;
  wearR: number;
  avgTemp: number;
  avgWear: number;
}

export enum SessionState {
  Invalid = 0,
  GetInCar = 1,
  Warmup = 2,
  ParadeLaps = 3,
  Racing = 4,
  Checkered = 5,
  CoolDown = 6,
}

export enum SessionFlags {
  None = 0,
  Checkered = 0x00000001,
  White = 0x00000002,
  Green = 0x00000004,
  Yellow = 0x00000008,
  Red = 0x00000010,
  Blue = 0x00000020,
  Debris = 0x00000040,
  Crossed = 0x00000080,
  YellowWaving = 0x00000100,
  OneLapToGreen = 0x00000200,
  GreenHeld = 0x00000400,
  TenToGo = 0x00000800,
  FiveToGo = 0x00001000,
  RandomWaving = 0x00002000,
  Caution = 0x00004000,
  CautionWaving = 0x00008000,
}

/**
 * Opponent/competitor data
 */
export interface OpponentData {
  carIdx: number;
  driverName: string;
  carNumber: string;
  teamName?: string;
  carName?: string;
  carClass?: string;
  lap: number;
  lapDistPct: number;
  position: number;
  classPosition: number;
  lastLapTime: number;
  bestLapTime: number;
  estimatedLapTime?: number;
  gapToPlayer: number;
  gapToLeader?: number;
  isAhead?: boolean;
  isBattle?: boolean;
  onPitRoad?: boolean;
  isOnPitRoad?: boolean;  // Alias for backward compatibility
  pitStopCount?: number;
  trackSurface: number;
}

export enum TrackSurface {
  NotInWorld = -1,
  OffTrack = 0,
  InPitStall = 1,
  AproachingPits = 2,
  OnTrack = 3,
}
