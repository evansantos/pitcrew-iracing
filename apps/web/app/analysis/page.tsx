'use client';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { LapComparison } from '@/components/analysis/lap-comparison';
import { TelemetryTraces } from '@/components/analysis/telemetry-traces';

interface SessionSummary {
  sessionId: string;
  racerName: string;
  trackName: string;
  carName: string;
  startTime: number;
  totalLaps: number;
}

interface LapBoundary {
  lap: number;
  startSeq: number;
  endSeq: number;
  lapTime: number | null;
}

interface DeltaPoint {
  dist: number;
  delta: number;
}

interface TracePoint {
  x: number;
  speed: number;
  throttle: number;
  brake: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function AnalysisPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [laps, setLaps] = useState<LapBoundary[]>([]);
  const [traceData, setTraceData] = useState<TracePoint[]>([]);
  const [selectedTraceLap, setSelectedTraceLap] = useState<number | null>(null);

  // Load sessions
  useEffect(() => {
    fetch(`${API_URL}/api/sessions`)
      .then((r) => r.json())
      .then(setSessions)
      .catch(console.error);
  }, []);

  // Load laps when session selected
  useEffect(() => {
    if (!selectedSession) return;
    fetch(`${API_URL}/api/sessions/${selectedSession}/laps`)
      .then((r) => r.json())
      .then((data: LapBoundary[]) => {
        setLaps(data);
        setSelectedTraceLap(null);
        setTraceData([]);
      })
      .catch(console.error);
  }, [selectedSession]);

  // Load trace data for selected lap
  useEffect(() => {
    if (!selectedSession || selectedTraceLap === null) return;
    fetch(`${API_URL}/api/sessions/${selectedSession}/frames?laps=${selectedTraceLap}`)
      .then((r) => r.json())
      .then((frames: Array<{ lapDistPct: number; telemetry: { player: { speed: number; throttle: number; brake: number } } }>) => {
        setTraceData(frames.map((f) => ({
          x: f.lapDistPct,
          speed: f.telemetry.player.speed,
          throttle: f.telemetry.player.throttle,
          brake: f.telemetry.player.brake,
        })));
      })
      .catch(console.error);
  }, [selectedSession, selectedTraceLap]);

  const handleCompareLaps = async (lap1: number, lap2: number): Promise<DeltaPoint[]> => {
    if (!selectedSession) return [];

    const [frames1, frames2] = await Promise.all([
      fetch(`${API_URL}/api/sessions/${selectedSession}/frames?laps=${lap1}`).then((r) => r.json()),
      fetch(`${API_URL}/api/sessions/${selectedSession}/frames?laps=${lap2}`).then((r) => r.json()),
    ]);

    // Client-side delta calculation
    const grid = 100;
    const delta: DeltaPoint[] = [];
    for (let i = 0; i <= grid; i++) {
      const dist = i / grid;
      const f1 = findNearest(frames1, dist);
      const f2 = findNearest(frames2, dist);
      if (f1 && f2) {
        const t1 = f1.telemetry.sessionTime ?? 0;
        const t2 = f2.telemetry.sessionTime ?? 0;
        const lapStart1 = frames1[0]?.telemetry.sessionTime ?? 0;
        const lapStart2 = frames2[0]?.telemetry.sessionTime ?? 0;
        delta.push({ dist, delta: (t1 - lapStart1) - (t2 - lapStart2) });
      }
    }
    return delta;
  };

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Lap Analysis</h1>

        {/* Session selector */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Session</label>
          <select
            className="rounded-md border bg-secondary px-3 py-1.5 text-sm"
            value={selectedSession ?? ''}
            onChange={(e) => setSelectedSession(e.target.value || null)}
          >
            <option value="">Select session...</option>
            {sessions.map((s) => (
              <option key={s.sessionId} value={s.sessionId}>
                {s.trackName} — {s.carName} — {new Date(s.startTime).toLocaleDateString()} ({s.totalLaps} laps)
              </option>
            ))}
          </select>
        </div>

        {/* Lap comparison */}
        {selectedSession && (
          <LapComparison
            laps={laps.map((l) => ({ lap: l.lap, lapTime: l.lapTime }))}
            onCompareLaps={handleCompareLaps}
          />
        )}

        {/* Telemetry traces with lap selector */}
        {selectedSession && laps.length > 0 && (
          <div>
            <div className="mb-2">
              <label className="mb-1 block text-xs text-muted-foreground">Trace Lap</label>
              <select
                className="rounded-md border bg-secondary px-3 py-1.5 text-sm"
                value={selectedTraceLap ?? ''}
                onChange={(e) => setSelectedTraceLap(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Select lap for traces...</option>
                {laps.map((l) => (
                  <option key={l.lap} value={l.lap}>
                    Lap {l.lap} {l.lapTime ? `— ${(l.lapTime).toFixed(3)}s` : ''}
                  </option>
                ))}
              </select>
            </div>
            {traceData.length > 0 && <TelemetryTraces data={traceData} />}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function findNearest(
  frames: Array<{ lapDistPct: number; telemetry: { sessionTime?: number } }>,
  dist: number,
): { telemetry: { sessionTime?: number } } | null {
  if (frames.length === 0) return null;
  let closest = frames[0];
  let minDist = Math.abs(frames[0].lapDistPct - dist);
  for (const f of frames) {
    const d = Math.abs(f.lapDistPct - dist);
    if (d < minDist) {
      minDist = d;
      closest = f;
    }
  }
  return closest;
}
