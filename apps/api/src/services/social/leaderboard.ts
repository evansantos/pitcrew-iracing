/**
 * Leaderboard — session history with rankings and driver stats.
 * Aggregates best laps, session scores, and track records.
 */

export interface LeaderboardEntry {
  racerName: string;
  trackName: string;
  carName: string;
  bestLapTime: number;
  sessionDate: number;
  sessionId: string;
  totalLaps: number;
  driverScore?: number;
}

export interface TrackRecord {
  trackName: string;
  carName: string;
  bestLapTime: number;
  racerName: string;
  sessionDate: number;
  sessionId: string;
}

export interface LeaderboardStats {
  totalSessions: number;
  totalLaps: number;
  uniqueTracks: number;
  uniqueCars: number;
  averageLapTime: number;
  bestOverallLap: TrackRecord | null;
}

/**
 * Build leaderboard entries from session summaries.
 */
export function buildLeaderboard(
  sessions: Array<{
    sessionId: string;
    racerName: string;
    trackName: string;
    carName: string;
    startTime: number;
    totalLaps: number;
    laps?: Array<{ lap: number; lapTime: number | null }>;
  }>,
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];

  for (const session of sessions) {
    if (!session.laps || session.laps.length === 0) continue;

    const validLaps = session.laps.filter(l => l.lapTime !== null && l.lapTime > 0);
    if (validLaps.length === 0) continue;

    const bestLap = validLaps.reduce((best, l) =>
      l.lapTime! < best.lapTime! ? l : best
    );

    entries.push({
      racerName: session.racerName,
      trackName: session.trackName,
      carName: session.carName,
      bestLapTime: bestLap.lapTime!,
      sessionDate: session.startTime,
      sessionId: session.sessionId,
      totalLaps: session.totalLaps,
    });
  }

  return entries.sort((a, b) => a.bestLapTime - b.bestLapTime);
}

/**
 * Get track records — best lap per track+car combination.
 */
export function getTrackRecords(entries: LeaderboardEntry[]): TrackRecord[] {
  const records = new Map<string, TrackRecord>();

  for (const entry of entries) {
    const key = `${entry.trackName}::${entry.carName}`;
    const existing = records.get(key);

    if (!existing || entry.bestLapTime < existing.bestLapTime) {
      records.set(key, {
        trackName: entry.trackName,
        carName: entry.carName,
        bestLapTime: entry.bestLapTime,
        racerName: entry.racerName,
        sessionDate: entry.sessionDate,
        sessionId: entry.sessionId,
      });
    }
  }

  return Array.from(records.values()).sort((a, b) => a.trackName.localeCompare(b.trackName));
}

/**
 * Calculate aggregate stats from leaderboard entries.
 */
export function calculateStats(entries: LeaderboardEntry[]): LeaderboardStats {
  if (entries.length === 0) {
    return {
      totalSessions: 0,
      totalLaps: 0,
      uniqueTracks: 0,
      uniqueCars: 0,
      averageLapTime: 0,
      bestOverallLap: null,
    };
  }

  const totalLaps = entries.reduce((sum, e) => sum + e.totalLaps, 0);
  const avgLapTime = entries.reduce((sum, e) => sum + e.bestLapTime, 0) / entries.length;
  const tracks = new Set(entries.map(e => e.trackName));
  const cars = new Set(entries.map(e => e.carName));

  const best = entries.reduce((b, e) => e.bestLapTime < b.bestLapTime ? e : b);

  return {
    totalSessions: entries.length,
    totalLaps,
    uniqueTracks: tracks.size,
    uniqueCars: cars.size,
    averageLapTime: Math.round(avgLapTime * 1000) / 1000,
    bestOverallLap: {
      trackName: best.trackName,
      carName: best.carName,
      bestLapTime: best.bestLapTime,
      racerName: best.racerName,
      sessionDate: best.sessionDate,
      sessionId: best.sessionId,
    },
  };
}
