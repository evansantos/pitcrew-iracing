'use client';

import { useTelemetryStore } from '@/stores/telemetry-store';
import { normalizeTelemetryData, isSpectatingMode } from '@/lib/telemetry-utils';
import type { OpponentData } from '@iracing-race-engineer/shared';

export function Opponents() {
  const rawData = useTelemetryStore((state) => state.data);
  const isLive = useTelemetryStore((state) => state.isLive);

  const data = normalizeTelemetryData(rawData);

  if (!isLive || !data) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Opponents</h3>
        <p className="text-sm text-muted-foreground">Waiting for opponent data...</p>
      </div>
    );
  }

  const spectating = isSpectatingMode(rawData);

  // In spectating mode, use drivers array instead of opponents
  const opponents = spectating ? (data.drivers || []) : (data.opponents || []);
  const sortedOpponents = [...opponents].sort((a, b) => a.position - b.position);

  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '--:--.---';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
  };

  const formatGap = (gap: number): string => {
    if (gap === 0) return 'Leader';
    const absGap = Math.abs(gap);
    const sign = gap > 0 ? '-' : '+';
    if (absGap < 60) {
      return `${sign}${absGap.toFixed(1)}s`;
    }
    return `${sign}${Math.floor(absGap / 60)}:${(absGap % 60).toFixed(1)}`;
  };

  const getPositionColor = (position: number): string => {
    if (position === 1) return 'bg-yellow-500';
    if (position === 2) return 'bg-gray-300';
    if (position === 3) return 'bg-orange-400';
    return 'bg-secondary';
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Live Standings</h3>

      {opponents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No opponent data available</p>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 border-b pb-2 text-xs font-semibold text-muted-foreground">
            <div className="col-span-1">Pos</div>
            <div className="col-span-1">#</div>
            <div className="col-span-4">Driver</div>
            <div className="col-span-2 text-right">Best Lap</div>
            <div className="col-span-2 text-right">Last Lap</div>
            <div className="col-span-2 text-right">Gap</div>
          </div>

          {/* Opponents List */}
          {sortedOpponents.map((opponent) => {
            const isPlayer = opponent.position === data.player.position;

            return (
              <div
                key={opponent.carIdx}
                className={`grid grid-cols-12 gap-2 items-center rounded-lg p-2 transition-colors ${
                  isPlayer
                    ? 'bg-primary/20 border border-primary/40'
                    : 'hover:bg-secondary/50'
                }`}
              >
                {/* Position */}
                <div className="col-span-1">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${
                      isPlayer ? 'bg-primary text-primary-foreground' : getPositionColor(opponent.position)
                    }`}
                  >
                    {opponent.position}
                  </div>
                </div>

                {/* Car Number */}
                <div className="col-span-1 text-xs font-mono font-semibold">{opponent.carNumber}</div>

                {/* Driver Name */}
                <div className="col-span-4">
                  <div className={`text-sm font-semibold ${isPlayer ? 'text-primary' : ''}`}>
                    {opponent.driverName}
                    {isPlayer && <span className="ml-2 text-xs text-primary/70">(You)</span>}
                  </div>
                  {opponent.teamName && (
                    <div className="text-xs text-muted-foreground italic">
                      {opponent.teamName}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Lap {opponent.lap} ({(opponent.lapDistPct * 100).toFixed(0)}%)
                  </div>
                </div>

                {/* Best Lap */}
                <div className="col-span-2 text-right font-mono text-xs">
                  {formatTime(opponent.bestLapTime)}
                </div>

                {/* Last Lap */}
                <div className="col-span-2 text-right font-mono text-xs">
                  {formatTime(opponent.lastLapTime)}
                </div>

                {/* Gap */}
                <div className="col-span-2 text-right">
                  {opponent.position === 1 ? (
                    <span className="text-xs font-semibold text-yellow-500">Leader</span>
                  ) : (
                    <span className="text-xs font-mono">
                      {formatGap(opponent.gapToPlayer)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Stats */}
      {opponents.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4">
          <div className="rounded-lg bg-secondary p-3">
            <div className="text-xs text-muted-foreground">Field Size</div>
            <div className="mt-1 text-xl font-bold">{opponents.length + 1}</div>
          </div>
          <div className="rounded-lg bg-secondary p-3">
            <div className="text-xs text-muted-foreground">Gap to Leader</div>
            <div className="mt-1 text-lg font-mono font-semibold">
              {formatGap(
                sortedOpponents.find((o) => o.position === 1)?.gapToPlayer || 0
              )}
            </div>
          </div>
          <div className="rounded-lg bg-secondary p-3">
            <div className="text-xs text-muted-foreground">Gap to Next</div>
            <div className="mt-1 text-lg font-mono font-semibold">
              {(() => {
                const nextCar = sortedOpponents.find(
                  (o) => o.position === data.player.position - 1
                );
                return nextCar ? formatGap(nextCar.gapToPlayer) : 'N/A';
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
