'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ProcessedTelemetry } from '@iracing-race-engineer/shared';

/**
 * Glance view — minimal mobile/watch-friendly dashboard.
 * Shows the most critical info: position, lap time, fuel laps remaining.
 */
export default function GlancePage() {
  const [telemetry, setTelemetry] = useState<ProcessedTelemetry | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';
    const socket: Socket = io(wsUrl, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('identify', { type: 'webapp' });
      socket.emit('subscribe:telemetry');
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('telemetry:update', (data: { telemetry: ProcessedTelemetry }) => {
      setTelemetry(data.telemetry);
    });

    return () => {
      socket.close();
    };
  }, []);

  const formatTime = (seconds: number | undefined) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  const fuelLaps = telemetry?.fuel?.lapsRemaining ?? 0;
  const fuelColor = fuelLaps < 3 ? '#ef4444' : fuelLaps < 5 ? '#f59e0b' : '#22c55e';

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-white"
      role="main"
      aria-label="Glance view"
    >
      {!connected && (
        <p className="text-2xl text-gray-400" aria-live="polite">Connecting...</p>
      )}

      {connected && !telemetry && (
        <p className="text-2xl text-gray-400" aria-live="polite">Waiting for data</p>
      )}

      {connected && telemetry && (
        <div className="flex w-full max-w-sm flex-col gap-6 text-center">
          {/* Position */}
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500">Position</p>
            <p className="text-7xl font-bold tabular-nums" aria-label={`Position ${telemetry.player?.position}`}>
              P{telemetry.player?.position ?? '-'}
            </p>
          </div>

          {/* Lap time */}
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500">Last Lap</p>
            <p className="text-4xl font-bold tabular-nums">
              {formatTime(telemetry.player?.lastLapTime)}
            </p>
          </div>

          {/* Fuel laps */}
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500">Fuel Laps</p>
            <p
              className="text-5xl font-bold tabular-nums"
              style={{ color: fuelColor }}
              aria-label={`${fuelLaps.toFixed(1)} laps of fuel remaining`}
            >
              {fuelLaps.toFixed(1)}
            </p>
          </div>

          {/* Lap counter */}
          <div className="text-sm text-gray-500">
            Lap {telemetry.player?.lap ?? 0}
          </div>
        </div>
      )}
    </div>
  );
}
