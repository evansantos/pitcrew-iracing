'use client';

import { useTelemetryStore } from '@/stores/telemetry-store';
import { normalizeTelemetryData, isSpectatingMode } from '@/lib/telemetry-utils';
import { useState, useEffect } from 'react';

interface LapHistory {
  lapNumber: number;
  lapTime: number;
  avgTireWear: number;
  avgTireTemp: number;
  fuelUsed: number;
  timestamp: number;
}

export function TireStrategy() {
  const rawData = useTelemetryStore((state) => state.data);
  const backendStrategy = useTelemetryStore((state) => state.strategy);
  const isLive = useTelemetryStore((state) => state.isLive);

  // Flag to indicate if we're using backend strategy or local calculations
  const useBackendStrategy = backendStrategy !== null && backendStrategy.tireStrategy !== undefined;

  // Track lap history in component state
  const [lapHistory, setLapHistory] = useState<LapHistory[]>([]);
  const [lastLapRecorded, setLastLapRecorded] = useState(0);

  const data = normalizeTelemetryData(rawData);

  // Record tire wear data every lap (regardless of completion status)
  useEffect(() => {
    if (!data || !data.player || !data.tires) return;

    const currentLap = data.player.lap;

    // Record tire wear whenever we're on a new lap (clean or not)
    if (currentLap > lastLapRecorded && currentLap > 0) {
      const avgTireWear = (
        data.tires.lf.avgWear +
        data.tires.rf.avgWear +
        data.tires.lr.avgWear +
        data.tires.rr.avgWear
      ) / 4;

      const avgTireTemp = (
        data.tires.lf.avgTemp +
        data.tires.rf.avgTemp +
        data.tires.lr.avgTemp +
        data.tires.rr.avgTemp
      ) / 4;

      const lastLapTime = data.player.lastLapTime;

      const newLap: LapHistory = {
        lapNumber: currentLap, // Current lap we just started
        lapTime: lastLapTime > 0 ? lastLapTime : 0, // May be 0 if incident occurred
        avgTireWear,
        avgTireTemp,
        fuelUsed: 0, // Can calculate from fuel level delta later
        timestamp: Date.now(),
      };

      setLapHistory((prev) => {
        const updated = [...prev, newLap];
        // Keep only last 30 laps
        return updated.slice(-30);
      });

      setLastLapRecorded(currentLap);
    }
  }, [data, lastLapRecorded]);

  if (!isLive || !data || !data.tires || !data.player) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Tire Strategy</h3>
        <p className="text-sm text-muted-foreground">Waiting for tire data...</p>
      </div>
    );
  }

  const spectating = isSpectatingMode(rawData);

  if (spectating) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Tire Strategy</h3>
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            👁️ Spectating Mode - Tire strategy not available
          </p>
        </div>
      </div>
    );
  }

  // Calculate tire metrics
  const avgTireWear = (
    data.tires.lf.avgWear +
    data.tires.rf.avgWear +
    data.tires.lr.avgWear +
    data.tires.rr.avgWear
  ) / 4;

  const tireHealth = avgTireWear * 100;

  // Calculate tire wear rate (% per lap) - use local calculation
  let tireWearRate = 0;
  let debugInfo = '';
  let lapsOnTires = 0;
  let changeRecommended = false;

  if (useBackendStrategy && backendStrategy.tireStrategy) {
    // Use backend tire change recommendation
    changeRecommended = backendStrategy.tireStrategy.changeRequired || false;
  }

  // Always use local calculation for wear rate since backend doesn't provide degradation rate
  if (lapHistory.length >= 2) {
    const oldestLap = lapHistory[0];
    const currentLap = data.player.lap;
    const lapsElapsed = currentLap - oldestLap.lapNumber;

    if (lapsElapsed > 0) {
      // Calculate wear difference (positive number as tires degrade from 1.0 to 0.0)
      const wearDifference = oldestLap.avgTireWear - avgTireWear;
      // Convert to percentage per lap
      tireWearRate = (wearDifference / lapsElapsed) * 100;
      lapsOnTires = lapsElapsed;
    }
  }

  // Predict laps until tire drop-off (< 20% health)
  const lapsUntilDropOff = tireWearRate > 0
    ? Math.floor((tireHealth - 20) / tireWearRate)
    : 999;

  // Calculate lap time degradation - need at least 6 laps (3 early + 3 recent)
  let lapTimeDelta = 0;
  let avgRecentLapTime = 0;
  let avgEarlyLapTime = 0;

  if (lapHistory.length >= 6) {
    // Filter out invalid lap times (0 or very low)
    const validLaps = lapHistory.filter(lap => lap.lapTime > 10);

    if (validLaps.length >= 6) {
      // Compare last 3 valid laps vs first 3 valid laps
      const recentLaps = validLaps.slice(-3);
      const earlyLaps = validLaps.slice(0, 3);

      avgRecentLapTime = recentLaps.reduce((sum, lap) => sum + lap.lapTime, 0) / recentLaps.length;
      avgEarlyLapTime = earlyLaps.reduce((sum, lap) => sum + lap.lapTime, 0) / earlyLaps.length;

      lapTimeDelta = avgRecentLapTime - avgEarlyLapTime;
    }
  }

  // Optimal tire change window
  const shouldChangeTires = tireHealth < 30;
  const tireChangeWindowStart = lapsUntilDropOff > 5 ? lapsUntilDropOff - 5 : 1;
  const tireChangeWindowEnd = lapsUntilDropOff;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Tire Strategy</h3>
        <div className={`text-xs px-2 py-0.5 rounded-full ${
          useBackendStrategy
            ? 'bg-green-500/10 text-green-500 border border-green-500/20'
            : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
        }`}>
          {useBackendStrategy ? '🔗 Backend' : '💻 Local'}
        </div>
      </div>

      <div className="space-y-4">
        {/* Tire Health & Degradation */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-secondary p-4">
            <div className="text-xs text-muted-foreground">Current Health</div>
            <div className={`mt-1 text-3xl font-bold ${
              tireHealth > 50 ? 'text-green-500' :
              tireHealth > 30 ? 'text-yellow-500' :
              'text-red-500'
            }`}>
              {tireHealth.toFixed(0)}%
            </div>
          </div>

          <div className="rounded-lg bg-secondary p-4">
            <div className="text-xs text-muted-foreground">Wear Rate</div>
            {lapHistory.length >= 2 && tireWearRate > 0 ? (
              <>
                <div className={`mt-1 text-3xl font-bold ${
                  tireWearRate < 2 ? 'text-green-500' :
                  tireWearRate < 4 ? 'text-yellow-500' :
                  'text-red-500'
                }`}>
                  {tireWearRate.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  per lap ({lapsOnTires} laps tracked)
                </div>
              </>
            ) : (
              <>
                <div className="mt-1 text-3xl font-bold text-muted-foreground">
                  --
                </div>
                <div className="text-xs text-muted-foreground">
                  {lapHistory.length < 2
                    ? `calculating... (${lapHistory.length}/2 laps)`
                    : 'calculating...'}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Lap Time Degradation */}
        {avgEarlyLapTime > 0 && avgRecentLapTime > 0 && (
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">📊</span>
              <div className="flex-1">
                <div className="font-semibold text-sm">Lap Time Degradation</div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Early Laps Avg</div>
                    <div className="font-mono text-sm font-semibold">
                      {formatTime(avgEarlyLapTime)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Recent Laps Avg</div>
                    <div className="font-mono text-sm font-semibold">
                      {formatTime(avgRecentLapTime)}
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-xs text-muted-foreground">Delta</div>
                  <div className={`font-mono text-lg font-bold ${
                    lapTimeDelta < 0.5 ? 'text-green-500' :
                    lapTimeDelta < 1.5 ? 'text-yellow-500' :
                    'text-red-500'
                  }`}>
                    +{lapTimeDelta.toFixed(3)}s
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Drop-off Prediction */}
        <div className="rounded-lg bg-secondary p-4">
          <div className="text-xs font-semibold text-muted-foreground mb-3">
            Tire Drop-off Prediction
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-sm text-muted-foreground">Laps Until Drop-off (&lt;20%)</span>
              <span className={`text-2xl font-bold ${
                lapsUntilDropOff > 10 ? 'text-green-500' :
                lapsUntilDropOff > 5 ? 'text-yellow-500' :
                'text-red-500'
              }`}>
                {lapsUntilDropOff > 100 ? '∞' : lapsUntilDropOff}
              </span>
            </div>
            {lapsUntilDropOff < 100 && (
              <div className="h-3 w-full overflow-hidden rounded-full bg-background">
                <div
                  className={`h-full transition-all ${
                    lapsUntilDropOff > 10 ? 'bg-green-500' :
                    lapsUntilDropOff > 5 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${Math.min((lapsUntilDropOff / 20) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Tire Change Recommendation */}
        {(shouldChangeTires || (useBackendStrategy && changeRecommended)) && (
          <div className="rounded-lg border-2 border-red-500 bg-red-500/10 p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <div className="font-semibold text-red-500">Tire Change Recommended</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {useBackendStrategy && backendStrategy.tireStrategy?.reasoning
                    ? backendStrategy.tireStrategy.reasoning[0]
                    : 'Tire health critical. Change tires on next pit stop.'}
                </div>
                {!useBackendStrategy && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Optimal window: <span className="font-semibold">Laps {tireChangeWindowStart}-{tireChangeWindowEnd}</span>
                  </div>
                )}
                {useBackendStrategy && backendStrategy.tireStrategy?.reasoning && backendStrategy.tireStrategy.reasoning.length > 1 && (
                  <div className="mt-3 space-y-1">
                    {backendStrategy.tireStrategy.reasoning.slice(1).map((reason, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground">
                        • {reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Lap History Chart (simplified bar chart) */}
        {lapHistory.length > 0 && (
          <div>
            <div className="mb-3 text-xs font-semibold text-muted-foreground">
              Recent Lap Times ({lapHistory.length} laps)
            </div>
            <div className="flex items-end gap-1 h-20">
              {lapHistory.slice(-15).map((lap, idx) => {
                const minTime = Math.min(...lapHistory.map(l => l.lapTime));
                const maxTime = Math.max(...lapHistory.map(l => l.lapTime));
                const range = maxTime - minTime || 1;
                const height = ((lap.lapTime - minTime) / range) * 100;

                return (
                  <div
                    key={idx}
                    className="flex-1 bg-primary rounded-t transition-all"
                    style={{ height: `${Math.max(height, 20)}%` }}
                    title={`Lap ${lap.lapNumber}: ${formatTime(lap.lapTime)}`}
                  />
                );
              })}
            </div>
            <div className="mt-2 text-xs text-center text-muted-foreground">
              Last {Math.min(15, lapHistory.length)} laps
            </div>
          </div>
        )}

        {/* Individual Tire Health */}
        <div>
          <div className="mb-3 text-xs font-semibold text-muted-foreground">
            Individual Tire Health
          </div>
          <div className="grid grid-cols-4 gap-2">
            <TireHealthCard label="LF" wear={data.tires.lf.avgWear} />
            <TireHealthCard label="RF" wear={data.tires.rf.avgWear} />
            <TireHealthCard label="LR" wear={data.tires.lr.avgWear} />
            <TireHealthCard label="RR" wear={data.tires.rr.avgWear} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TireHealthCard({ label, wear }: { label: string; wear: number }) {
  const health = wear * 100;
  const getColor = () => {
    if (health > 50) return 'text-green-500';
    if (health > 30) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="rounded-lg bg-secondary p-2">
      <div className="text-xs text-muted-foreground text-center">{label}</div>
      <div className={`mt-1 text-xl font-bold text-center ${getColor()}`}>
        {health.toFixed(0)}%
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '--:--.---';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
}
