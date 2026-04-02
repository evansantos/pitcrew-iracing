'use client';

import { useEffect, useState } from 'react';
import { useTelemetryStore } from '@/stores/telemetry-store';

interface RelayMetrics {
  clientCount: number;
  totalBytesSent: number;
  bytesPerSecond: number;
  totalFrames: number;
  framesPerSecond: number;
  latency: { min: number; avg: number; max: number };
  uptime: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function RelayDashboard() {
  const relayConnected = useTelemetryStore((state) => state.relayConnected);
  const isLive = useTelemetryStore((state) => state.isLive);
  const lastUpdateTime = useTelemetryStore((state) => state.lastUpdateTime);

  // Simulated metrics from telemetry updates (in a real implementation,
  // these would come from the relay's stats message via Socket.IO)
  const [metrics, setMetrics] = useState<RelayMetrics>({
    clientCount: 0,
    totalBytesSent: 0,
    bytesPerSecond: 0,
    totalFrames: 0,
    framesPerSecond: 0,
    latency: { min: 0, avg: 0, max: 0 },
    uptime: 0,
  });

  const [frameCounter, setFrameCounter] = useState(0);
  const [startTime] = useState(Date.now());

  // Track incoming frames for local throughput estimation
  useEffect(() => {
    if (!lastUpdateTime) return;
    setFrameCounter((prev) => prev + 1);
  }, [lastUpdateTime]);

  // Update derived metrics every second
  useEffect(() => {
    const interval = setInterval(() => {
      const uptimeSeconds = Math.round((Date.now() - startTime) / 1000);
      setMetrics((prev) => ({
        ...prev,
        clientCount: relayConnected ? 1 : 0,
        totalFrames: frameCounter,
        framesPerSecond: uptimeSeconds > 0 ? Math.round(frameCounter / uptimeSeconds) : 0,
        uptime: uptimeSeconds,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [relayConnected, frameCounter, startTime]);

  const statusColor = relayConnected && isLive ? 'text-green-500' : 'text-gray-500';
  const statusLabel = relayConnected && isLive ? 'Connected' : 'Disconnected';

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="mb-4 text-lg font-bold">Relay Dashboard</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {/* Connection Status */}
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Status</p>
          <p className={`text-lg font-semibold ${statusColor}`}>{statusLabel}</p>
        </div>

        {/* Connected Clients */}
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Clients</p>
          <p className="text-lg font-semibold">{metrics.clientCount}</p>
        </div>

        {/* Throughput */}
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Throughput</p>
          <p className="text-lg font-semibold">{formatBytes(metrics.bytesPerSecond)}/s</p>
        </div>

        {/* Total Data */}
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Total Sent</p>
          <p className="text-lg font-semibold">{formatBytes(metrics.totalBytesSent)}</p>
        </div>

        {/* Frames */}
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Frames</p>
          <p className="text-lg font-semibold">{metrics.totalFrames.toLocaleString()}</p>
        </div>

        {/* FPS */}
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Frame Rate</p>
          <p className="text-lg font-semibold">{metrics.framesPerSecond} fps</p>
        </div>

        {/* Latency */}
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Latency (min/avg/max)</p>
          <p className="text-lg font-semibold">
            {metrics.latency.min}/{metrics.latency.avg}/{metrics.latency.max}
            <span className="text-xs text-muted-foreground ml-1">ms</span>
          </p>
        </div>

        {/* Uptime */}
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Uptime</p>
          <p className="text-lg font-semibold">{formatUptime(metrics.uptime)}</p>
        </div>
      </div>
    </div>
  );
}
