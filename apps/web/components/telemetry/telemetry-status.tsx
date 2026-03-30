'use client';

import { useWebSocket } from '@/hooks/use-websocket';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { normalizeTelemetryData } from '@/lib/telemetry-utils';

export function TelemetryStatus() {
  useWebSocket(); // Initialize WebSocket connection

  const connected = useTelemetryStore((state) => state.connected);
  const isLive = useTelemetryStore((state) => state.isLive);
  const rawData = useTelemetryStore((state) => state.data);
  const data = normalizeTelemetryData(rawData);

  const status = !connected ? 'disconnected' : isLive ? 'active' : 'connected';

  const statusColors = {
    disconnected: 'bg-red-500',
    connected: 'bg-yellow-500',
    active: 'bg-green-500',
  };

  const statusLabels = {
    disconnected: 'Disconnected',
    connected: 'Connected',
    active: 'Receiving Data',
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <div className={`h-3 w-3 rounded-full ${statusColors[status]} animate-pulse`} />
        <span className="text-sm font-medium">{statusLabels[status]}</span>
      </div>
      <div className="text-sm text-muted-foreground">
        {connected
          ? isLive
            ? `Session: ${data?.player.lap || 0} laps`
            : 'WebSocket connected'
          : 'Waiting for connection...'}
      </div>
      {isLive && data && (
        <div className="ml-auto text-sm font-mono">
          Speed: {Math.round(data.player.speed)} km/h | Gear: {data.player.gear}
        </div>
      )}
    </div>
  );
}
