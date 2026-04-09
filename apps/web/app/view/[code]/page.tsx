'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { LiveGauges } from '@/components/telemetry/live-gauges';
import { SessionInfo } from '@/components/telemetry/session-info';
import { FuelManagement } from '@/components/telemetry/fuel-management';
import { TireStrategy } from '@/components/telemetry/tire-strategy';
import type { ProcessedTelemetry } from '@iracing-race-engineer/shared';

export default function ViewerPage() {
  const params = useParams<{ code: string }>();
  const updateTelemetry = useTelemetryStore((s) => s.updateTelemetry);
  const updateStrategy = useTelemetryStore((s) => s.updateStrategy);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'ended'>('connecting');
  const [racerName, setRacerName] = useState<string>('');
  const [viewerCount, setViewerCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';
    const socket: Socket = io(wsUrl, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
      socket.emit('join:share', { code: params.code });
    });

    socket.on('sharing:joined', (data: { racerName: string; viewerCount: number }) => {
      setStatus('connected');
      setRacerName(data.racerName);
      setViewerCount(data.viewerCount);
    });

    socket.on('sharing:error', (data: { error: string }) => {
      setStatus('error');
      setErrorMsg(data.error);
    });

    socket.on('sharing:ended', () => {
      setStatus('ended');
    });

    socket.on('sharing:viewers', (data: { viewerCount: number }) => {
      setViewerCount(data.viewerCount);
    });

    socket.on('telemetry:update', (data: { racerName: string; telemetry: ProcessedTelemetry }) => {
      updateTelemetry(data.racerName, data.telemetry);
    });

    socket.on('strategy:update', (data: unknown) => {
      updateStrategy(data as never);
    });

    return () => {
      socket.close();
    };
  }, [params.code, updateTelemetry, updateStrategy]);

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4">
        {/* Viewer header */}
        <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
          <span className="rounded bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">VIEWER</span>
          {status === 'connected' && (
            <>
              <span className="text-sm">Watching {racerName}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {viewerCount} viewer{viewerCount !== 1 ? 's' : ''} | Code: {params.code}
              </span>
            </>
          )}
          {status === 'connecting' && <span className="text-sm text-muted-foreground">Connecting...</span>}
          {status === 'error' && <span className="text-sm text-red-400">{errorMsg}</span>}
          {status === 'ended' && <span className="text-sm text-amber-400">Session ended</span>}
        </div>

        {/* Dashboard — read-only, same components as driver */}
        {status === 'connected' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <LiveGauges />
            <SessionInfo />
            <FuelManagement />
            <TireStrategy />
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
