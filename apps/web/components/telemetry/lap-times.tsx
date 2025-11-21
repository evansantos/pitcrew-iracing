'use client';

import { useTelemetryStore } from '@/stores/telemetry-store';
import { normalizeTelemetryData } from '@/lib/telemetry-utils';

export function LapTimes() {
  const rawData = useTelemetryStore((state) => state.data);
  const isLive = useTelemetryStore((state) => state.isLive);

  const data = normalizeTelemetryData(rawData);

  if (!isLive || !data) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Lap Times</h3>
        <p className="text-sm text-muted-foreground">Waiting for lap data...</p>
      </div>
    );
  }

  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '--:--.---';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
  };

  const getDelta = (): string | null => {
    if (!data.player.bestLapTime || data.player.bestLapTime <= 0) return null;
    if (!data.player.lastLapTime || data.player.lastLapTime <= 0) return null;
    const delta = data.player.lastLapTime - data.player.bestLapTime;
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(3)}`;
  };

  const delta = getDelta();
  const isPersonalBest = data.player.lastLapTime === data.player.bestLapTime && data.player.lastLapTime > 0;

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Lap Times</h3>

      <div className="space-y-4">
        {/* Current Lap */}
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Current Lap</div>
          <div className="text-3xl font-mono font-bold tabular-nums">
            {formatTime(data.player.currentLapTime)}
          </div>
        </div>

        {/* Lap Number & Position */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Lap</div>
            <div className="text-2xl font-bold">{data.player.lap}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Position</div>
            <div className="text-2xl font-bold">P{data.player.position}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Class</div>
            <div className="text-2xl font-bold">P{data.player.classPosition}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Incidents</div>
            <div className={`text-2xl font-bold ${(data.player.incidents || 0) === 0 ? 'text-green-500' : 'text-orange-500'}`}>
              {data.player.incidents || 0}x
            </div>
          </div>
        </div>

        {/* Last Lap */}
        <div className="border-t pt-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Last Lap</span>
            {isPersonalBest && (
              <span className="rounded bg-purple-500 px-2 py-0.5 text-xs font-semibold text-white">
                PB
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-mono font-semibold tabular-nums">
              {formatTime(data.player.lastLapTime)}
            </div>
            {delta && !isPersonalBest && (
              <div
                className={`text-sm font-mono ${
                  parseFloat(delta) > 0 ? 'text-red-500' : 'text-green-500'
                }`}
              >
                {delta}
              </div>
            )}
          </div>
        </div>

        {/* Best Lap */}
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Best Lap</div>
          <div className="text-2xl font-mono font-semibold tabular-nums text-green-500">
            {formatTime(data.player.bestLapTime)}
          </div>
        </div>

        {/* Track Progress */}
        <div>
          <div className="mb-2 text-xs text-muted-foreground">
            Track Progress: {(data.player.lapDistPct * 100).toFixed(1)}%
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary transition-all duration-100"
              style={{ width: `${data.player.lapDistPct * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
