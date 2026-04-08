'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { LiveGauges } from '@/components/telemetry/live-gauges';
import { SessionInfo } from '@/components/telemetry/session-info';
import { FuelManagement } from '@/components/telemetry/fuel-management';
import { TireStrategy } from '@/components/telemetry/tire-strategy';

interface SessionIndex {
  sessionId: string;
  racerName: string;
  trackName: string;
  carName: string;
  sessionType: string;
  startTime: number;
  endTime: number | null;
  totalFrames: number;
  laps: Array<{ lap: number; startSeq: number; endSeq: number; lapTime: number | null }>;
}

interface StoredFrame {
  seq: number;
  lap: number;
  lapDistPct: number;
  telemetry: Record<string, unknown>;
}

const SPEED_OPTIONS = [0.5, 1, 2, 4];

export default function ReplayPage() {
  const params = useParams<{ sessionId: string }>();
  const updateTelemetry = useTelemetryStore((s) => s.updateTelemetry);

  const [sessionIndex, setSessionIndex] = useState<SessionIndex | null>(null);
  const [frames, setFrames] = useState<StoredFrame[]>([]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cursorRef = useRef(0);
  cursorRef.current = cursor;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  // Fetch session data
  useEffect(() => {
    Promise.all([
      fetch(`${apiUrl}/api/sessions/${params.sessionId}`).then((r) => r.ok ? r.json() : Promise.reject('Session not found')),
      fetch(`${apiUrl}/api/sessions/${params.sessionId}/frames`).then((r) => r.ok ? r.json() : Promise.reject('Frames not found')),
    ])
      .then(([index, framesData]) => {
        setSessionIndex(index);
        setFrames(framesData);
        if (framesData.length > 0) {
          updateTelemetry(index.racerName, framesData[0].telemetry);
        }
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [params.sessionId, apiUrl, updateTelemetry]);

  // Push current frame to telemetry store
  const emitFrame = useCallback((idx: number) => {
    const frame = frames[idx];
    if (frame && sessionIndex) {
      updateTelemetry(sessionIndex.racerName, frame.telemetry as never);
    }
  }, [frames, sessionIndex, updateTelemetry]);

  // Play/pause logic
  useEffect(() => {
    if (playing && frames.length > 0) {
      const baseInterval = frames.length >= 2
        ? Math.abs(((frames[1].telemetry as { sessionTime?: number }).sessionTime ?? 0) -
                    ((frames[0].telemetry as { sessionTime?: number }).sessionTime ?? 0)) * 1000
        : 16;
      const interval = Math.max(1, baseInterval / speed);

      playTimerRef.current = setInterval(() => {
        const next = cursorRef.current + 1;
        if (next >= frames.length) {
          setPlaying(false);
          return;
        }
        setCursor(next);
        emitFrame(next);
      }, interval);
    }

    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [playing, speed, frames, emitFrame]);

  const handleSeek = (frame: number) => {
    setCursor(frame);
    emitFrame(frame);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      setPlaying((p) => !p);
    } else if (e.code === 'ArrowRight') {
      const next = Math.min(cursorRef.current + 1, frames.length - 1);
      setCursor(next);
      emitFrame(next);
    } else if (e.code === 'ArrowLeft') {
      const prev = Math.max(cursorRef.current - 1, 0);
      setCursor(prev);
      emitFrame(prev);
    }
  }, [frames.length, emitFrame]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (loading) return <DashboardShell><p className="text-muted-foreground p-8">Loading session...</p></DashboardShell>;
  if (error) return <DashboardShell><p className="text-red-400 p-8">Error: {error}</p></DashboardShell>;

  const lapMarkers = sessionIndex?.laps.map((l) => ({
    lap: l.lap,
    position: frames.length > 0 ? l.startSeq / frames.length : 0,
  })) ?? [];

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4">
        {/* Replay header */}
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">REPLAY</span>
          <span className="text-sm text-muted-foreground">
            {sessionIndex?.trackName} — {sessionIndex?.carName} — {sessionIndex?.racerName}
          </span>
        </div>

        {/* Scrubber bar */}
        <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
          <button
            onClick={() => setPlaying(!playing)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {playing ? 'Pause' : 'Play'}
          </button>

          <div className="relative flex-1">
            <input
              type="range"
              min={0}
              max={Math.max(frames.length - 1, 0)}
              value={cursor}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="w-full"
            />
            <div className="absolute top-0 left-0 h-full w-full pointer-events-none">
              {lapMarkers.map((m) => (
                <div
                  key={m.lap}
                  className="absolute top-0 h-full w-px bg-amber-500/40"
                  style={{ left: `${m.position * 100}%` }}
                  title={`Lap ${m.lap}`}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>Frame {cursor} / {frames.length}</span>
              <span>Lap {frames[cursor]?.lap ?? '-'}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded px-2 py-1 text-xs ${
                  speed === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard components — same as live */}
        <div className="grid gap-4 lg:grid-cols-2">
          <LiveGauges />
          <SessionInfo />
          <FuelManagement />
          <TireStrategy />
        </div>
      </div>
    </DashboardShell>
  );
}
