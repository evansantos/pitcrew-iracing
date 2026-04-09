'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

interface SessionSummary {
  sessionId: string;
  racerName: string;
  trackName: string;
  carName: string;
  sessionType: string;
  startTime: number;
  endTime: number | null;
  totalFrames: number;
  totalLaps: number;
  source: 'live' | 'import';
}

export default function ReplayBrowserPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    fetch(`${apiUrl}/api/sessions`)
      .then((res) => res.json())
      .then((data) => setSessions(data))
      .catch((err) => console.error('Failed to load sessions:', err))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (ts: number) => new Date(ts).toLocaleString();
  const formatDuration = (start: number, end: number | null) => {
    if (!end) return 'In progress';
    const secs = Math.round((end - start) / 1000);
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    return `${mins}m ${remainSecs}s`;
  };

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Session Replay</h1>

        {loading && <p className="text-muted-foreground">Loading sessions...</p>}

        {!loading && sessions.length === 0 && (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-muted-foreground">No recorded sessions found.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Sessions are automatically recorded when a relay connects.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <Link
              key={s.sessionId}
              href={`/replay/${s.sessionId}`}
              className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">{s.trackName}</span>
                <span className="rounded bg-secondary px-2 py-0.5 text-xs">{s.sessionType}</span>
              </div>
              <p className="text-sm text-muted-foreground">{s.carName}</p>
              <p className="text-sm text-muted-foreground">{s.racerName}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatDate(s.startTime)}</span>
                <span>{s.totalLaps} laps</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatDuration(s.startTime, s.endTime)}</span>
                <span>{s.totalFrames.toLocaleString()} frames</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
