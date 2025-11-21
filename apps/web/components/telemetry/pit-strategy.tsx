'use client';

import { useTelemetryStore } from '@/stores/telemetry-store';
import { normalizeTelemetryData, isSpectatingMode } from '@/lib/telemetry-utils';

export function PitStrategy() {
  const rawData = useTelemetryStore((state) => state.data);
  const isLive = useTelemetryStore((state) => state.isLive);

  const data = normalizeTelemetryData(rawData);

  if (!isLive || !data || !data.fuel || !data.tires || !data.session || !data.player) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Pit Strategy</h3>
        <p className="text-sm text-muted-foreground">Waiting for telemetry data...</p>
      </div>
    );
  }

  const spectating = isSpectatingMode(rawData);

  if (spectating) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Pit Strategy</h3>
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            👁️ Spectating Mode - Pit strategy not available
          </p>
        </div>
      </div>
    );
  }

  // Fuel calculations
  const currentLap = data.player.lap || 0;
  const fuelPerLap = currentLap > 0 && data.fuel.usePerHour > 0
    ? (data.fuel.usePerHour / 60) * (data.player.lastLapTime / 60)
    : 0;

  const fuelLapsRemaining = fuelPerLap > 0
    ? Math.floor(data.fuel.level / fuelPerLap)
    : 0;

  const raceLapsRemaining = data.session.lapsRemaining || 0;
  const canFinishOnFuel = fuelLapsRemaining >= raceLapsRemaining;

  // Tire calculations
  const avgTireWear = (
    data.tires.lf.avgWear +
    data.tires.rf.avgWear +
    data.tires.lr.avgWear +
    data.tires.rr.avgWear
  ) / 4;
  const tireHealth = avgTireWear * 100;

  // Determine pit need
  const needsPitForFuel = !canFinishOnFuel;
  const needsPitForTires = tireHealth < 30;
  const needsPit = needsPitForFuel || needsPitForTires;

  // Calculate optimal pit lap
  let optimalPitLap = 0;
  let pitReason = '';

  if (needsPitForFuel && needsPitForTires) {
    // Pit for both - use whichever is more urgent
    const fuelUrgency = fuelLapsRemaining - 2; // 2 lap safety margin
    const tireUrgency = tireHealth < 20 ? 1 : 3; // Pit ASAP if < 20%, else within 3 laps
    optimalPitLap = currentLap + Math.min(fuelUrgency, tireUrgency);
    pitReason = 'fuel + tires';
  } else if (needsPitForFuel) {
    optimalPitLap = currentLap + (fuelLapsRemaining - 2); // 2 lap safety
    pitReason = 'fuel';
  } else if (needsPitForTires) {
    optimalPitLap = currentLap + (tireHealth < 20 ? 1 : 3);
    pitReason = 'tires';
  }

  // Traffic analysis
  const opponents = data.opponents || [];
  const playerPosition = data.player.position || 0;

  // Cars ahead have lower position numbers and positive gap (we're behind them)
  const carsAhead = opponents.filter(
    (o) => o.position < playerPosition && o.position > 0 && o.gapToPlayer > 0 && o.gapToPlayer < 5
  );

  // Cars behind have higher position numbers and negative gap (they're behind us)
  const carsBehind = opponents.filter(
    (o) => o.position > playerPosition && o.gapToPlayer < 0 && Math.abs(o.gapToPlayer) < 5
  );

  // Undercut opportunity detection - cars ahead within 3 seconds
  const undercutOpportunity = carsAhead.length > 0 && carsAhead.some(
    (car) => car.gapToPlayer > 0 && car.gapToPlayer < 3 && !car.isOnPitRoad
  );

  // Get the closest cars for undercut display
  const undercutTargets = carsAhead.filter(
    (car) => car.gapToPlayer > 0 && car.gapToPlayer < 3 && !car.isOnPitRoad
  );

  // Estimate pit stop time loss (typical ~25s pit stop + ~2s exit loss)
  const pitStopTimeLoss = 27;

  // Calculate time comparison
  const lapsUntilOptimalPit = optimalPitLap - currentLap;

  // Estimate staying out vs pitting now
  const stayingOutTimeGain = lapsUntilOptimalPit > 0
    ? lapsUntilOptimalPit * 0.5 // Assume 0.5s/lap degradation
    : 0;

  const pittingNowLoss = pitStopTimeLoss;
  const pittingLaterLoss = pitStopTimeLoss + stayingOutTimeGain;

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Pit Strategy</h3>

      <div className="space-y-6">
        {/* Can Finish Status - Always visible */}
        <div className={`rounded-lg border-2 p-4 transition-opacity ${
          needsPit ? 'opacity-40' : 'opacity-100'
        } border-green-500 bg-green-500/10`}>
          <div className="flex items-start gap-3">
            <span className="text-3xl">✅</span>
            <div className="flex-1">
              <div className="font-semibold text-lg text-green-500">
                Can Finish Without Pitting
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Fuel Status</div>
                  <div className={`text-lg font-semibold ${canFinishOnFuel ? 'text-green-500' : 'text-red-500'}`}>
                    {canFinishOnFuel ? `${fuelLapsRemaining} laps` : `Need ${raceLapsRemaining - fuelLapsRemaining} more`}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Tire Status</div>
                  <div className={`text-lg font-semibold ${tireHealth > 30 ? 'text-green-500' : 'text-red-500'}`}>
                    {tireHealth.toFixed(0)}% health
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pit Stop Required - Always visible */}
        <div className={`rounded-lg border-2 p-4 transition-opacity ${
          needsPit ? 'opacity-100' : 'opacity-40'
        } border-orange-500 bg-orange-500/10`}>
          <div className="flex items-start gap-3">
            <span className="text-3xl">🏁</span>
            <div className="flex-1">
              <div className="font-semibold text-lg text-orange-500">
                Pit Stop Required
              </div>
              {needsPit ? (
                <div className="mt-2 space-y-1">
                  <div className="text-sm text-muted-foreground">
                    Reason: <span className="font-semibold">{pitReason}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Optimal pit lap: <span className="font-mono font-semibold">Lap {optimalPitLap}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    In: <span className="font-mono font-semibold">{lapsUntilOptimalPit} laps</span>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-muted-foreground">
                  Current fuel and tire levels are sufficient to complete the race
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Time Analysis */}
        {needsPit && lapsUntilOptimalPit > 0 && (
          <div>
            <div className="mb-3 text-xs font-semibold text-muted-foreground">
              Pit Timing Analysis
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <div className="text-xs text-muted-foreground">Pit Now</div>
                <div className="mt-1 text-2xl font-bold text-red-500">
                  -{pittingNowLoss.toFixed(1)}s
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Time loss
                </div>
              </div>
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                <div className="text-xs text-muted-foreground">Pit on Lap {optimalPitLap}</div>
                <div className="mt-1 text-2xl font-bold text-yellow-500">
                  -{pittingLaterLoss.toFixed(1)}s
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Time loss (incl. degradation)
                </div>
              </div>
            </div>
            {pittingNowLoss < pittingLaterLoss && (
              <div className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                <div className="text-xs text-blue-400">
                  💡 Pitting now is {(pittingLaterLoss - pittingNowLoss).toFixed(1)}s faster than waiting
                </div>
              </div>
            )}
          </div>
        )}

        {/* Traffic Considerations */}
        <div>
          <div className="mb-3 text-xs font-semibold text-muted-foreground">
            Traffic Situation
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-secondary p-3">
              <div className="text-xs text-muted-foreground">Cars Ahead</div>
              <div className="mt-1 text-2xl font-bold">{carsAhead.length}</div>
              <div className="text-xs text-muted-foreground">within 5s</div>
              {carsAhead.length > 0 && (
                <div className="mt-2 space-y-1">
                  {carsAhead.slice(0, 3).map((car) => (
                    <div key={car.carIdx} className="text-xs flex justify-between">
                      <span className="truncate">{car.driverName}</span>
                      <span className="font-mono text-yellow-500">+{car.gapToPlayer.toFixed(1)}s</span>
                    </div>
                  ))}
                  {carsAhead.length > 3 && (
                    <div className="text-xs text-muted-foreground">+{carsAhead.length - 3} more</div>
                  )}
                </div>
              )}
            </div>
            <div className="rounded-lg bg-secondary p-3">
              <div className="text-xs text-muted-foreground">Cars Behind</div>
              <div className="mt-1 text-2xl font-bold">{carsBehind.length}</div>
              <div className="text-xs text-muted-foreground">within 5s</div>
              {carsBehind.length > 0 && (
                <div className="mt-2 space-y-1">
                  {carsBehind.slice(0, 3).map((car) => (
                    <div key={car.carIdx} className="text-xs flex justify-between">
                      <span className="truncate">{car.driverName}</span>
                      <span className="font-mono text-blue-500">{car.gapToPlayer.toFixed(1)}s</span>
                    </div>
                  ))}
                  {carsBehind.length > 3 && (
                    <div className="text-xs text-muted-foreground">+{carsBehind.length - 3} more</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Undercut Opportunity */}
        {undercutOpportunity && needsPit && (
          <div className="rounded-lg border-2 border-purple-500 bg-purple-500/10 p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎯</span>
              <div className="flex-1">
                <div className="font-semibold text-purple-400">Undercut Opportunity</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {undercutTargets.length} car(s) ahead within 3s. Early pit stop could gain positions!
                </div>
                {undercutTargets.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-xs text-muted-foreground">Undercut targets:</div>
                    {undercutTargets.slice(0, 3).map((car) => (
                      <div key={car.carIdx} className="text-xs flex justify-between">
                        <span className="truncate">P{car.position} - {car.driverName}</span>
                        <span className="font-mono text-purple-400">+{car.gapToPlayer.toFixed(1)}s</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2 text-xs font-semibold text-purple-400">
                  💡 Consider pitting 2-3 laps earlier than optimal
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pit Stop Checklist */}
        {needsPit && (
          <div>
            <div className="mb-3 text-xs font-semibold text-muted-foreground">
              Pit Stop Checklist
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`h-4 w-4 rounded ${needsPitForFuel ? 'bg-red-500' : 'bg-gray-500'}`}>
                  {needsPitForFuel && <span className="text-white text-xs">✓</span>}
                </div>
                <span className="text-sm">Add Fuel ({needsPitForFuel ? 'Required' : 'Optional'})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-4 w-4 rounded ${needsPitForTires ? 'bg-red-500' : 'bg-gray-500'}`}>
                  {needsPitForTires && <span className="text-white text-xs">✓</span>}
                </div>
                <span className="text-sm">Change Tires ({needsPitForTires ? 'Required' : 'Optional'})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-gray-500" />
                <span className="text-sm">Repair Damage (If needed)</span>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-secondary p-3">
              <div className="text-xs text-muted-foreground">Fuel Laps</div>
              <div className={`mt-1 text-xl font-bold ${
                canFinishOnFuel ? 'text-green-500' : 'text-red-500'
              }`}>
                {fuelLapsRemaining}
              </div>
            </div>
            <div className="rounded-lg bg-secondary p-3">
              <div className="text-xs text-muted-foreground">Tire Health</div>
              <div className={`mt-1 text-xl font-bold ${
                tireHealth > 50 ? 'text-green-500' :
                tireHealth > 30 ? 'text-yellow-500' :
                'text-red-500'
              }`}>
                {tireHealth.toFixed(0)}%
              </div>
            </div>
            <div className="rounded-lg bg-secondary p-3">
              <div className="text-xs text-muted-foreground">Race Laps Left</div>
              <div className="mt-1 text-xl font-bold">
                {raceLapsRemaining}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
