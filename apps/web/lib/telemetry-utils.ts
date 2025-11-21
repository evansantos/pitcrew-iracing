/**
 * Utilities for handling hybrid telemetry data
 * Supports both full telemetry (driving) and SessionInfo (spectating) modes
 */

export interface NormalizedTelemetryData {
  mode: 'full_telemetry' | 'session_info';
  player: {
    driverName: string;
    carName: string;
    lap: number;
    position: number;
    classPosition: number;
    speed: number;
    rpm: number;
    gear: number;
    throttle: number;
    brake: number;
    currentLapTime: number;
    lastLapTime: number;
    bestLapTime: number;
    lapDistPct: number;
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
    lf: { tempL: number; tempM: number; tempR: number; wearL: number; wearM: number; wearR: number; pressure: number; avgTemp: number; avgWear: number };
    rf: { tempL: number; tempM: number; tempR: number; wearL: number; wearM: number; wearR: number; pressure: number; avgTemp: number; avgWear: number };
    lr: { tempL: number; tempM: number; tempR: number; wearL: number; wearM: number; wearR: number; pressure: number; avgTemp: number; avgWear: number };
    rr: { tempL: number; tempM: number; tempR: number; wearL: number; wearM: number; wearR: number; pressure: number; avgTemp: number; avgWear: number };
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
    state: number;
    flags: number;
    timeRemaining: number;
    lapsRemaining: number;
    type?: string;
    name?: string;
  };
  opponents?: any[];
  drivers?: any[];
  damage?: any;
}

/**
 * Normalize telemetry data to a consistent format
 * Handles both full telemetry and SessionInfo modes
 */
export function normalizeTelemetryData(data: any): NormalizedTelemetryData | null {
  if (!data) return null;

  const dataMode = data.mode;

  // FULL TELEMETRY MODE (driving)
  if (dataMode === 'full_telemetry' || data.player) {
    return {
      mode: 'full_telemetry',
      player: data.player || {
        driverName: 'Unknown Driver',
        carName: 'Unknown Car',
        lap: 0,
        position: 0,
        classPosition: 0,
        speed: 0,
        rpm: 0,
        gear: 0,
        throttle: 0,
        brake: 0,
        currentLapTime: 0,
        lastLapTime: 0,
        bestLapTime: 0,
        lapDistPct: 0,
        incidents: 0,
        oilTemp: 0,
        oilPress: 0,
        waterTemp: 0,
        waterLevel: 0,
        voltage: 0,
        engineWarnings: 0,
        manifoldPress: 0,
        push2PassStatus: false,
        push2PassCount: 0,
        dcBrakePct: 0,
        clutch: 0,
      },
      fuel: data.fuel || {
        level: 0,
        levelPct: 0,
        usePerHour: 0,
        lapsRemaining: 0,
      },
      tires: data.tires || {
        lf: { tempL: 0, tempM: 0, tempR: 0, wearL: 1, wearM: 1, wearR: 1, pressure: 0, avgTemp: 0, avgWear: 1 },
        rf: { tempL: 0, tempM: 0, tempR: 0, wearL: 1, wearM: 1, wearR: 1, pressure: 0, avgTemp: 0, avgWear: 1 },
        lr: { tempL: 0, tempM: 0, tempR: 0, wearL: 1, wearM: 1, wearR: 1, pressure: 0, avgTemp: 0, avgWear: 1 },
        rr: { tempL: 0, tempM: 0, tempR: 0, wearL: 1, wearM: 1, wearR: 1, pressure: 0, avgTemp: 0, avgWear: 1 },
      },
      track: data.track || {
        name: 'Unknown Track',
        temperature: 20,
        airTemp: 20,
        windSpeed: 0,
        windDirection: 0,
        humidity: 50,
      },
      session: data.session || {
        state: 0,
        flags: 0,
        timeRemaining: 0,
        lapsRemaining: 0,
        type: 'Unknown',
        name: 'Unknown',
      },
      opponents: data.opponents,
      drivers: data.drivers,
      damage: data.damage,
    };
  }

  // SESSION INFO MODE (spectating)
  if (dataMode === 'session_info') {
    // Find player in drivers array
    const playerDriver = data.drivers?.find((d: any) => d.isPlayer);

    return {
      mode: 'session_info',
      player: {
        driverName: playerDriver?.driverName || 'Unknown Driver',
        carName: playerDriver?.carName || 'Unknown Car',
        lap: playerDriver?.lap || 0,
        position: playerDriver?.position || 0,
        classPosition: playerDriver?.classPosition || 0,
        speed: 0, // Not available in spectating
        rpm: 0,
        gear: 0,
        throttle: 0,
        brake: 0,
        currentLapTime: 0,
        lastLapTime: playerDriver?.lastLapTime || 0,
        bestLapTime: playerDriver?.bestLapTime || 0,
        lapDistPct: 0,
        incidents: 0, // Not available in spectating
        oilTemp: 0,
        oilPress: 0,
        waterTemp: 0,
        waterLevel: 0,
        voltage: 0,
        engineWarnings: 0,
        manifoldPress: 0,
        push2PassStatus: false,
        push2PassCount: 0,
        dcBrakePct: 0,
        clutch: 0,
      },
      fuel: {
        level: 0, // Not available
        levelPct: 0,
        usePerHour: 0,
        lapsRemaining: 0,
      },
      tires: {
        lf: { tempL: 0, tempM: 0, tempR: 0, wearL: 1, wearM: 1, wearR: 1, pressure: 0, avgTemp: 0, avgWear: 1 },
        rf: { tempL: 0, tempM: 0, tempR: 0, wearL: 1, wearM: 1, wearR: 1, pressure: 0, avgTemp: 0, avgWear: 1 },
        lr: { tempL: 0, tempM: 0, tempR: 0, wearL: 1, wearM: 1, wearR: 1, pressure: 0, avgTemp: 0, avgWear: 1 },
        rr: { tempL: 0, tempM: 0, tempR: 0, wearL: 1, wearM: 1, wearR: 1, pressure: 0, avgTemp: 0, avgWear: 1 },
      },
      track: {
        name: 'Unknown Track',
        temperature: 20, // Not available in spectating
        airTemp: 20,
        windSpeed: 0,
        windDirection: 0,
        humidity: 50,
      },
      session: {
        state: 0,
        flags: 0,
        timeRemaining: data.session?.timeRemaining || 0,
        lapsRemaining: data.session?.lapsRemaining || 0,
        type: data.session?.type || 'Unknown',
        name: data.session?.name || 'Unknown',
      },
      drivers: data.drivers,
    };
  }

  // Fallback for unknown format - return safe defaults
  return {
    mode: 'full_telemetry',
    player: {
      driverName: 'Unknown Driver',
      carName: 'Unknown Car',
      lap: 0,
      position: 0,
      classPosition: 0,
      speed: 0,
      rpm: 0,
      gear: 0,
      throttle: 0,
      brake: 0,
      currentLapTime: 0,
      lastLapTime: 0,
      bestLapTime: 0,
      lapDistPct: 0,
      incidents: 0,
      oilTemp: 0,
      oilPress: 0,
      waterTemp: 0,
      waterLevel: 0,
      voltage: 0,
      engineWarnings: 0,
      manifoldPress: 0,
      push2PassStatus: false,
      push2PassCount: 0,
      dcBrakePct: 0,
      clutch: 0,
    },
    fuel: {
      level: 0,
      levelPct: 0,
      usePerHour: 0,
      lapsRemaining: 0,
    },
    tires: {
      lf: { tempL: 0, tempM: 0, tempR: 0, wearL: 1, wearM: 1, wearR: 1, pressure: 0, avgTemp: 0, avgWear: 1 },
      rf: { tempL: 0, tempM: 0, tempR: 0, wearL: 1, wearM: 1, wearR: 1, pressure: 0, avgTemp: 0, avgWear: 1 },
      lr: { tempL: 0, tempM: 0, tempR: 0, wearL: 1, wearM: 1, wearR: 1, pressure: 0, avgTemp: 0, avgWear: 1 },
      rr: { tempL: 0, tempM: 0, tempR: 0, wearL: 1, wearM: 1, wearR: 1, pressure: 0, avgTemp: 0, avgWear: 1 },
    },
    track: {
      name: 'Unknown Track',
      temperature: 20,
      airTemp: 20,
      windSpeed: 0,
      windDirection: 0,
      humidity: 50,
    },
    session: {
      state: 0,
      flags: 0,
      timeRemaining: 0,
      lapsRemaining: 0,
      type: 'Unknown',
      name: 'Unknown',
    },
  };
}

/**
 * Check if we're in spectating mode (limited data)
 */
export function isSpectatingMode(data: any): boolean {
  return data?.mode === 'session_info';
}

/**
 * Check if full telemetry data is available
 */
export function hasFullTelemetry(data: any): boolean {
  return data?.mode === 'full_telemetry' || !!data?.player;
}
