'use client';

import { useTelemetryStore } from '@/stores/telemetry-store';
import { normalizeTelemetryData, isSpectatingMode } from '@/lib/telemetry-utils';

export function FuelManagement() {
  const rawData = useTelemetryStore((state) => state.data);
  const isLive = useTelemetryStore((state) => state.isLive);

  const data = normalizeTelemetryData(rawData);

  if (!isLive || !data || !data.fuel || !data.session) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Fuel Management</h3>
        <p className="text-sm text-muted-foreground">Waiting for fuel data...</p>
      </div>
    );
  }

  const spectating = isSpectatingMode(rawData);

  // In spectating mode, fuel data is not available
  if (spectating) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Fuel Management</h3>
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            👁️ Spectating Mode - Fuel data not available
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Driver needs to run relay server for real-time fuel monitoring.
          </p>
        </div>
      </div>
    );
  }

  // Calculate fuel consumption per lap with fallback methods
  const currentLap = data.player.lap || 0;
  const raceLapsRemaining = data.session.lapsRemaining || 0;

  let fuelPerLap = 0;
  let avgLapTime = data.player.lastLapTime || 0; // in seconds

  // Method 1: Use last lap time if available
  if (avgLapTime > 0 && data.fuel.usePerHour > 0) {
    fuelPerLap = (data.fuel.usePerHour / 3600) * avgLapTime; // L/hr to L/second, then multiply by seconds
  }
  // Method 2: Estimate lap time from session time remaining and laps remaining
  else if (raceLapsRemaining > 0 && data.session.timeRemaining > 0 && data.fuel.usePerHour > 0) {
    avgLapTime = data.session.timeRemaining / raceLapsRemaining;
    fuelPerLap = (data.fuel.usePerHour / 3600) * avgLapTime;
  }
  // Method 3: Estimate based on average lap time of 90 seconds
  else if (data.fuel.usePerHour > 0) {
    avgLapTime = 90; // Default 90 second lap
    fuelPerLap = (data.fuel.usePerHour / 3600) * avgLapTime;
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">Fuel Management</h3>

      <div className="space-y-4">
        {/* Fuel Level */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Fuel Remaining</span>
            <span className="text-2xl font-bold">{(data.fuel.level || 0).toFixed(1)}L</span>
          </div>
          <div className="h-8 w-full overflow-hidden rounded-lg bg-secondary">
            <div
              className={`h-full transition-all duration-300 ${
                (data.fuel.levelPct || 0) > 30 ? 'bg-green-500' : (data.fuel.levelPct || 0) > 15 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${data.fuel.levelPct || 0}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{(data.fuel.levelPct || 0).toFixed(1)}% remaining</div>
        </div>

        {/* Consumption Rate */}
        <div className="space-y-3">
          <div className="rounded-lg bg-secondary p-4">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Avg. Consumption</span>
              <span className="text-2xl font-mono font-bold">{(data.fuel.usePerHour || 0).toFixed(1)} <span className="text-sm text-muted-foreground">L/hr</span></span>
            </div>
          </div>
          <div className="rounded-lg bg-secondary p-4">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-muted-foreground">Per Lap</span>
              <span className="text-2xl font-mono font-bold">
                {fuelPerLap > 0 ? `${fuelPerLap.toFixed(2)}` : '--'} <span className="text-sm text-muted-foreground">L</span>
              </span>
            </div>
            {fuelPerLap > 0 && avgLapTime > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                Based on {avgLapTime.toFixed(1)}s avg lap
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
