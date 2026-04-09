import { describe, it, expect } from 'vitest';
import { buildLeaderboard, getTrackRecords, calculateStats } from '../leaderboard.js';

const sessions = [
  {
    sessionId: 'session-1',
    racerName: 'Driver A',
    trackName: 'Monza',
    carName: 'GT3',
    startTime: 1000,
    totalLaps: 10,
    laps: [
      { lap: 1, lapTime: 92.5 },
      { lap: 2, lapTime: 91.0 },
      { lap: 3, lapTime: 90.5 },
    ],
  },
  {
    sessionId: 'session-2',
    racerName: 'Driver B',
    trackName: 'Monza',
    carName: 'GT3',
    startTime: 2000,
    totalLaps: 8,
    laps: [
      { lap: 1, lapTime: 93.0 },
      { lap: 2, lapTime: 91.5 },
    ],
  },
  {
    sessionId: 'session-3',
    racerName: 'Driver A',
    trackName: 'Spa',
    carName: 'LMP2',
    startTime: 3000,
    totalLaps: 5,
    laps: [
      { lap: 1, lapTime: 140.0 },
      { lap: 2, lapTime: 138.5 },
    ],
  },
  {
    sessionId: 'session-4',
    racerName: 'Driver C',
    trackName: 'Monza',
    carName: 'GT3',
    startTime: 4000,
    totalLaps: 3,
    laps: [], // no laps
  },
];

describe('leaderboard', () => {
  describe('buildLeaderboard', () => {
    it('builds entries sorted by best lap time', () => {
      const entries = buildLeaderboard(sessions);
      expect(entries.length).toBe(3); // session-4 excluded (no laps)
      expect(entries[0].bestLapTime).toBeLessThanOrEqual(entries[1].bestLapTime);
    });

    it('picks the best lap from each session', () => {
      const entries = buildLeaderboard(sessions);
      const driverA = entries.find(e => e.sessionId === 'session-1');
      expect(driverA?.bestLapTime).toBe(90.5);
    });

    it('excludes sessions with no valid laps', () => {
      const entries = buildLeaderboard(sessions);
      expect(entries.find(e => e.sessionId === 'session-4')).toBeUndefined();
    });

    it('excludes sessions with null lap times', () => {
      const withNulls = [{
        sessionId: 'x', racerName: 'X', trackName: 'T', carName: 'C',
        startTime: 0, totalLaps: 1,
        laps: [{ lap: 1, lapTime: null }],
      }];
      expect(buildLeaderboard(withNulls)).toEqual([]);
    });
  });

  describe('getTrackRecords', () => {
    it('returns best lap per track+car combo', () => {
      const entries = buildLeaderboard(sessions);
      const records = getTrackRecords(entries);
      const monzaGT3 = records.find(r => r.trackName === 'Monza' && r.carName === 'GT3');
      expect(monzaGT3?.bestLapTime).toBe(90.5); // Driver A's best
      expect(monzaGT3?.racerName).toBe('Driver A');
    });

    it('returns one record per track+car', () => {
      const entries = buildLeaderboard(sessions);
      const records = getTrackRecords(entries);
      expect(records.length).toBe(2); // Monza/GT3 + Spa/LMP2
    });
  });

  describe('calculateStats', () => {
    it('calculates correct aggregate stats', () => {
      const entries = buildLeaderboard(sessions);
      const stats = calculateStats(entries);
      expect(stats.totalSessions).toBe(3);
      expect(stats.totalLaps).toBe(23); // 10 + 8 + 5
      expect(stats.uniqueTracks).toBe(2);
      expect(stats.uniqueCars).toBe(2);
    });

    it('finds best overall lap', () => {
      const entries = buildLeaderboard(sessions);
      const stats = calculateStats(entries);
      expect(stats.bestOverallLap?.bestLapTime).toBe(90.5);
    });

    it('returns zeros for empty entries', () => {
      const stats = calculateStats([]);
      expect(stats.totalSessions).toBe(0);
      expect(stats.bestOverallLap).toBeNull();
    });
  });
});
