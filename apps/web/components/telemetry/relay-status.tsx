'use client';

import { useEffect, useState } from 'react';
import { useTelemetryStore } from '@/stores/telemetry-store';

export function RelayStatus() {
  const relayConnected = useTelemetryStore((state) => state.relayConnected);
  const isLive = useTelemetryStore((state) => state.isLive);
  const lastUpdateTime = useTelemetryStore((state) => state.lastUpdateTime);
  const [timeSinceUpdate, setTimeSinceUpdate] = useState<string>('');

  useEffect(() => {
    if (!lastUpdateTime) {
      setTimeSinceUpdate('Never');
      return;
    }

    const updateTimer = () => {
      const secondsAgo = Math.floor((Date.now() - lastUpdateTime) / 1000);

      if (secondsAgo < 5) {
        setTimeSinceUpdate('Just now');
      } else if (secondsAgo < 60) {
        setTimeSinceUpdate(`${secondsAgo}s ago`);
      } else if (secondsAgo < 3600) {
        const minutes = Math.floor(secondsAgo / 60);
        setTimeSinceUpdate(`${minutes}m ago`);
      } else {
        const hours = Math.floor(secondsAgo / 3600);
        setTimeSinceUpdate(`${hours}h ago`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lastUpdateTime]);

  const getStatusColor = () => {
    if (relayConnected && isLive) {
      return 'bg-green-500';
    } else if (lastUpdateTime && Date.now() - lastUpdateTime < 60000) {
      // Data received within last minute, but relay disconnected
      return 'bg-yellow-500';
    } else {
      return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    if (relayConnected && isLive) {
      return 'LIVE';
    } else if (lastUpdateTime) {
      return 'OFFLINE';
    } else {
      return 'NO DATA';
    }
  };

  const getStatusDescription = () => {
    if (relayConnected && isLive) {
      return 'Relay connected, receiving live data';
    } else if (lastUpdateTime) {
      return `Last update: ${timeSinceUpdate}`;
    } else {
      return 'Waiting for relay connection';
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className={`h-3 w-3 rounded-full ${getStatusColor()} animate-pulse`} aria-label={`Connection status: ${getStatusText()}`} />
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{getStatusText()}</span>
            {relayConnected && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-500 border border-green-500/30">
                Relay
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{getStatusDescription()}</span>
        </div>
      </div>
    </div>
  );
}
