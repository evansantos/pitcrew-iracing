'use client';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

interface SessionData {
  sessionId: string;
  racerName: string;
  trackName: string;
  carName: string;
  startTime: number;
  endTime: number | null;
  totalFrames: number;
  totalLaps: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function LeaderboardPage() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ track: string; car: string }>({ track: '', car: '' });

  useEffect(() => {
    fetch(`${API_URL}/api/sessions`)
      .then((r) => r.json())
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const tracks = [...new Set(sessions.map(s => s.trackName))].sort();
  const cars = [...new Set(sessions.map(s => s.carName))].sort();

  const filtered = sessions.filter(s => {
    if (filter.track && s.trackName !== filter.track) return false;
    if (filter.car && s.carName !== filter.car) return false;
    return s.totalLaps >= 1;
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
  };

  const totalLaps = filtered.reduce((sum, s) => sum + s.totalLaps, 0);

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Leaderboard</h1>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{filtered.length}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{totalLaps}</p>
            <p className="text-xs text-muted-foreground">Total Laps</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{tracks.length}</p>
            <p className="text-xs text-muted-foreground">Tracks</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{cars.length}</p>
            <p className="text-xs text-muted-foreground">Cars</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Track</label>
            <select
              className="rounded-md border bg-secondary px-3 py-1.5 text-sm"
              value={filter.track}
              onChange={(e) => setFilter(f => ({ ...f, track: e.target.value }))}
            >
              <option value="">All tracks</option>
              {tracks.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Car</label>
            <select
              className="rounded-md border bg-secondary px-3 py-1.5 text-sm"
              value={filter.car}
              onChange={(e) => setFilter(f => ({ ...f, car: e.target.value }))}
            >
              <option value="">All cars</option>
              {cars.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Session table */}
        {loading && <p className="text-muted-foreground">Loading...</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-muted-foreground">No sessions found.</p>
        )}
        {filtered.length > 0 && (
          <div className="rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3">Date</th>
                  <th className="p-3">Track</th>
                  <th className="p-3">Car</th>
                  <th className="p-3">Driver</th>
                  <th className="p-3 text-right">Laps</th>
                  <th className="p-3 text-right">Duration</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .sort((a, b) => b.startTime - a.startTime)
                  .map((s) => (
                  <tr key={s.sessionId} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="p-3">{new Date(s.startTime).toLocaleDateString()}</td>
                    <td className="p-3 font-medium">{s.trackName}</td>
                    <td className="p-3">{s.carName}</td>
                    <td className="p-3">{s.racerName}</td>
                    <td className="p-3 text-right font-mono">{s.totalLaps}</td>
                    <td className="p-3 text-right font-mono">
                      {s.endTime ? `${Math.round((s.endTime - s.startTime) / 60000)}m` : 'Active'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
