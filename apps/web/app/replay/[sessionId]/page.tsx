'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

const SPEED_OPTIONS = [0.5, 1, 2, 4];

export default function ReplayPage() {
  const params = useParams<{ sessionId: string }>();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [cursor, setCursor] = useState(0);
  const [totalFrames] = useState(0);

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4">
        {/* Replay indicator */}
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">
            REPLAY
          </span>
          <span className="text-sm text-muted-foreground">
            Session: <code className="text-xs">{params.sessionId}</code>
          </span>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
          {/* Play/Pause */}
          <button
            onClick={() => setPlaying(!playing)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {playing ? 'Pause' : 'Play'}
          </button>

          {/* Seek slider */}
          <div className="flex-1">
            <input
              type="range"
              min={0}
              max={Math.max(totalFrames - 1, 0)}
              value={cursor}
              onChange={(e) => setCursor(Number(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>Frame {cursor}</span>
              <span>{totalFrames} total</span>
            </div>
          </div>

          {/* Speed selector */}
          <div className="flex items-center gap-1">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded px-2 py-1 text-xs ${
                  speed === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard components will render here with replayed telemetry data */}
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-muted-foreground">
            Dashboard components render here with replayed telemetry.
            Same components as live view — data source is the only difference.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Full integration with live dashboard components coming when FileStore data is loaded.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
