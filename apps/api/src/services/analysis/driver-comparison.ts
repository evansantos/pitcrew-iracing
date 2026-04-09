import type { StoredFrame } from '@iracing-race-engineer/shared';

export interface DriverLapSummary {
  racerName: string;
  lap: number;
  lapTime: number;
  avgSpeed: number;
  maxSpeed: number;
  avgThrottle: number;
  avgBrake: number;
  fuelUsed: number;
}

export interface ComparisonResult {
  driver1: DriverLapSummary;
  driver2: DriverLapSummary;
  delta: number;        // driver1.lapTime - driver2.lapTime (positive = driver1 slower)
  speedDelta: number;   // avg speed difference
  throttleDelta: number; // avg throttle difference
}

export function summarizeLap(racerName: string, frames: StoredFrame[]): DriverLapSummary {
  if (frames.length === 0) {
    return {
      racerName,
      lap: 0,
      lapTime: 0,
      avgSpeed: 0,
      maxSpeed: 0,
      avgThrottle: 0,
      avgBrake: 0,
      fuelUsed: 0,
    };
  }

  const lap = frames[0].lap;
  const lapTime = frames[frames.length - 1].telemetry.sessionTime - frames[0].telemetry.sessionTime;

  const speeds = frames.map(f => f.telemetry.player.speed);
  const avgSpeed = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
  const maxSpeed = Math.max(...speeds);

  const avgThrottle = frames.reduce((sum, f) => sum + f.telemetry.player.throttle, 0) / frames.length;
  const avgBrake = frames.reduce((sum, f) => sum + f.telemetry.player.brake, 0) / frames.length;

  const fuelUsed = frames[0].telemetry.fuel.level - frames[frames.length - 1].telemetry.fuel.level;

  return { racerName, lap, lapTime, avgSpeed, maxSpeed, avgThrottle, avgBrake, fuelUsed };
}

export function compareLaps(
  name1: string,
  frames1: StoredFrame[],
  name2: string,
  frames2: StoredFrame[],
): ComparisonResult {
  const driver1 = summarizeLap(name1, frames1);
  const driver2 = summarizeLap(name2, frames2);

  return {
    driver1,
    driver2,
    delta: driver1.lapTime - driver2.lapTime,
    speedDelta: driver1.avgSpeed - driver2.avgSpeed,
    throttleDelta: driver1.avgThrottle - driver2.avgThrottle,
  };
}

export function compareDriverSessions(
  _sessionId1: string,
  frames1: StoredFrame[],
  _sessionId2: string,
  frames2: StoredFrame[],
  racerName1: string,
  racerName2: string,
): ComparisonResult[] {
  const groupByLap = (frames: StoredFrame[]): Map<number, StoredFrame[]> => {
    const map = new Map<number, StoredFrame[]>();
    for (const frame of frames) {
      const lapFrames = map.get(frame.lap) ?? [];
      lapFrames.push(frame);
      map.set(frame.lap, lapFrames);
    }
    return map;
  };

  const laps1 = groupByLap(frames1);
  const laps2 = groupByLap(frames2);

  const results: ComparisonResult[] = [];

  for (const [lapNum, lapFrames1] of laps1) {
    const lapFrames2 = laps2.get(lapNum);
    if (!lapFrames2) continue;

    results.push(compareLaps(racerName1, lapFrames1, racerName2, lapFrames2));
  }

  return results;
}
