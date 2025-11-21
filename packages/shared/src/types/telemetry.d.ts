/**
 * Core telemetry data types for iRacing SDK integration
 */
/**
 * Raw telemetry data from iRacing SDK
 */
export interface IRSDKTelemetry {
    SessionTime: number;
    SessionTick: number;
    SessionNum: number;
    SessionState: number;
    SessionFlags: number;
    Speed: number;
    RPM: number;
    Gear: number;
    Throttle: number;
    Brake: number;
    Clutch: number;
    SteeringWheelAngle: number;
    Lap: number;
    LapDist: number;
    LapDistPct: number;
    LapBestLap: number;
    LapBestLapTime: number;
    LapLastLapTime: number;
    LapCurrentLapTime: number;
    PlayerCarMyIncidentCount: number;
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
    TrackTemp: number;
    TrackTempCrew: number;
    AirTemp: number;
    AirPressure: number;
    WindVel: number;
    WindDir: number;
    RelativeHumidity: number;
    FogLevel: number;
    Skies: number;
    LFshockDefl?: number;
    RFshockDefl?: number;
    LRshockDefl?: number;
    RRshockDefl?: number;
    PlayerCarTowTime?: number;
    PlayerCarInPitStall?: boolean;
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
        oilTemp: number;
        oilPress: number;
        waterTemp: number;
        waterLevel: number;
        voltage: number;
        engineWarnings: number;
        manifoldPress: number;
        push2PassStatus: boolean;
        push2PassCount: number;
        dcBrakePct: number;
        clutch: number;
    };
    fuel: {
        level: number;
        levelPct: number;
        usePerHour: number;
        lapsRemaining: number;
    };
    tires: {
        lf: TireData;
        rf: TireData;
        lr: TireData;
        rr: TireData;
    };
    track: {
        name: string;
        temperature: number;
        airTemp: number;
        windSpeed: number;
        windDirection: number;
        humidity: number;
    };
    session: {
        state: SessionState;
        flags: SessionFlags;
        timeRemaining: number;
        lapsRemaining: number;
        type?: string;
        name?: string;
    };
    opponents?: OpponentData[];
    damage?: {
        lf: number;
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
export declare enum SessionState {
    Invalid = 0,
    GetInCar = 1,
    Warmup = 2,
    ParadeLaps = 3,
    Racing = 4,
    Checkered = 5,
    CoolDown = 6
}
export declare enum SessionFlags {
    None = 0,
    Checkered = 1,
    White = 2,
    Green = 4,
    Yellow = 8,
    Red = 16,
    Blue = 32,
    Debris = 64,
    Crossed = 128,
    YellowWaving = 256,
    OneLapToGreen = 512,
    GreenHeld = 1024,
    TenToGo = 2048,
    FiveToGo = 4096,
    RandomWaving = 8192,
    Caution = 16384,
    CautionWaving = 32768
}
/**
 * Opponent/competitor data
 */
export interface OpponentData {
    carIdx: number;
    driverName: string;
    carNumber: string;
    teamName?: string;
    carClass: string;
    lap: number;
    lapDistPct: number;
    position: number;
    classPosition: number;
    lastLapTime: number;
    bestLapTime: number;
    estimatedLapTime: number;
    gapToPlayer: number;
    gapToLeader: number;
    isOnPitRoad: boolean;
    pitStopCount: number;
    trackSurface: TrackSurface;
}
export declare enum TrackSurface {
    NotInWorld = -1,
    OffTrack = 0,
    InPitStall = 1,
    AproachingPits = 2,
    OnTrack = 3
}
//# sourceMappingURL=telemetry.d.ts.map