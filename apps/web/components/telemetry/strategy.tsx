'use client';

import { useTelemetryStore } from '@/stores/telemetry-store';
import { normalizeTelemetryData, isSpectatingMode } from '@/lib/telemetry-utils';

export function Strategy() {
  const rawData = useTelemetryStore((state) => state.data);
  const backendStrategy = useTelemetryStore((state) => state.strategy);
  const isLive = useTelemetryStore((state) => state.isLive);
  const relayConnected = useTelemetryStore((state) => state.relayConnected);

  // Flag to indicate if we're using backend strategy or local calculations
  const useBackendStrategy = backendStrategy !== null;

  // Helper function to format time in human-readable format
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  let data;
  try {
    data = normalizeTelemetryData(rawData);
  } catch (error) {
    console.error('Error normalizing telemetry data:', error);
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Race Strategy & Pit Decision</h3>
        <p className="text-sm text-red-500">Error loading telemetry data</p>
      </div>
    );
  }

  // Early return if no relay connection or no data
  if (!relayConnected || !isLive || !data || !data.player || !data.fuel || !data.tires || !data.session) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Race Strategy & Pit Decision</h3>
        {!relayConnected ? (
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
            <p className="text-sm text-blue-600 dark:text-blue-400">
              🔌 Waiting for relay connection...
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Start the iRacing relay on your Windows machine to see live race strategy
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Waiting for telemetry data...</p>
        )}
      </div>
    );
  }

  const spectating = isSpectatingMode(rawData);

  // In spectating mode, show limited strategy info
  if (spectating) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Race Strategy & Pit Decision</h3>
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            👁️ Spectating Mode - Strategy calculations unavailable
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Fuel, tire, and pit strategy data requires the driver to run the relay server.
          </p>
        </div>
        {data.session && (
          <div className="mt-4 rounded-lg bg-secondary p-4">
            <div className="text-xs text-muted-foreground mb-2">Session Info</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Time Remaining</div>
                <div className="text-lg font-semibold">
                  {formatTime(data.session.timeRemaining)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Laps Remaining</div>
                <div className="text-lg font-semibold">
                  {data.session.lapsRemaining || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fuel calculations - use relay's improved calculation or backend data
  const currentLap = Number(data.player.lap) || 0;
  const rawRaceLapsRemaining = Number(data.session.lapsRemaining) || 0;

  // Handle unlimited sessions (practice/qualify) - iRacing sets to 32767
  const isUnlimitedSession = rawRaceLapsRemaining > 10000;
  const raceLapsRemaining = isUnlimitedSession ? 999 : rawRaceLapsRemaining;

  // Minimum fuel laps threshold for unlimited sessions
  const MIN_FUEL_LAPS_THRESHOLD = 10;

  // Use relay's fuel calculation as baseline (uses median of last 5-10 laps)
  let fuelLapsRemaining = data.fuel.lapsRemaining || 0;
  let fuelPerLap = data.fuel.avgPerLap || 2.5;
  let canFinishOnFuel = isUnlimitedSession
    ? fuelLapsRemaining >= MIN_FUEL_LAPS_THRESHOLD
    : fuelLapsRemaining >= raceLapsRemaining;

  // Override with backend values only if they're valid (not null/zero)
  if (useBackendStrategy && backendStrategy.fuelStrategy) {
    const backendLaps = backendStrategy.fuelStrategy.lapsUntilEmpty;
    const backendConsumption = backendStrategy.fuelStrategy.averageConsumption;

    // Only use backend values if they're valid numbers
    if (backendLaps != null && backendLaps > 0) {
      fuelLapsRemaining = backendLaps;
    }
    if (backendConsumption != null && backendConsumption > 0) {
      fuelPerLap = backendConsumption;
    }
    // Only override canFinish if backend value is explicitly set
    if (backendStrategy.fuelStrategy.canFinish != null) {
      canFinishOnFuel = backendStrategy.fuelStrategy.canFinish;
    }
  }

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

  // Calculate fuel to add and pit stops needed
  let fuelToAdd = 0;
  let pitStopsNeeded = 0;
  let lapsPerStop: number[] = [];

  if (needsPitForFuel && Number.isFinite(fuelPerLap) && Number.isFinite(data.fuel.level)) {
    const tankCapacity = data.fuel.tankCapacity || 100; // Use relay's tank capacity or default to 100L
    const SAFETY_MARGIN = 2; // 2 lap safety margin

    if (isUnlimitedSession) {
      // For unlimited sessions (practice/qualify), suggest filling tank
      fuelToAdd = Math.max(0, tankCapacity - data.fuel.level);
      pitStopsNeeded = 1;
      lapsPerStop = [Math.floor((fuelToAdd + data.fuel.level) / fuelPerLap)];
    } else if (Number.isFinite(raceLapsRemaining)) {
      // For race, calculate optimal pit strategy with tank capacity constraint
      const totalFuelNeeded = (raceLapsRemaining + SAFETY_MARGIN) * fuelPerLap;
      const currentFuel = data.fuel.level;
      const fuelDeficit = totalFuelNeeded - currentFuel;

      if (fuelDeficit > 0) {
        // Calculate maximum fuel we can add per stop
        const maxFuelPerStop = tankCapacity - currentFuel;

        // Calculate how many pit stops we need
        pitStopsNeeded = Math.ceil(fuelDeficit / tankCapacity);

        // Calculate laps per stint
        const lapsWithCurrentFuel = Math.floor(currentFuel / fuelPerLap);
        const lapsPerTankful = Math.floor(tankCapacity / fuelPerLap);

        lapsPerStop = [lapsWithCurrentFuel];
        for (let i = 1; i < pitStopsNeeded; i++) {
          lapsPerStop.push(lapsPerTankful);
        }

        // Last stint might not need full tank
        const remainingLaps = raceLapsRemaining - lapsPerStop.reduce((sum, laps) => sum + laps, 0);
        if (remainingLaps > 0) {
          lapsPerStop.push(remainingLaps);
        }

        // First pit stop: add fuel to fill tank
        fuelToAdd = Math.max(0, Math.min(maxFuelPerStop, totalFuelNeeded - currentFuel));
      }
    }
  }

  // Calculate optimal pit lap
  let optimalPitLap = 0;
  let pitReason = '';

  if (needsPitForFuel && needsPitForTires) {
    // Pit for both - use whichever is more urgent
    // Skip calculation if fuel data is invalid (0 or negative)
    if (fuelLapsRemaining > 0) {
      const fuelUrgency = fuelLapsRemaining - 2; // 2 lap safety margin
      const tireUrgency = tireHealth < 20 ? 1 : 3; // Pit ASAP if < 20%, else within 3 laps
      optimalPitLap = currentLap + Math.max(0, Math.min(fuelUrgency, tireUrgency));
      pitReason = 'fuel + tires';
    }
  } else if (needsPitForFuel) {
    // Skip calculation if fuel data is invalid (0 or negative)
    if (fuelLapsRemaining > 0) {
      const urgency = fuelLapsRemaining - 2;
      optimalPitLap = currentLap + Math.max(0, urgency); // 2 lap safety
      pitReason = 'fuel';
    }
  } else if (needsPitForTires) {
    optimalPitLap = currentLap + (tireHealth < 20 ? 1 : 3);
    pitReason = 'tires';
  }

  const lapsUntilOptimalPit = Number.isFinite(optimalPitLap) && Number.isFinite(currentLap)
    ? optimalPitLap - currentLap
    : 0;

  // Calculate dynamic race duration based on current lap + remaining laps
  const totalRaceLaps = currentLap + raceLapsRemaining;
  const raceDuration = totalRaceLaps > 0 ? totalRaceLaps : 50; // Default to 50 if unknown

  // Optimal pit window calculation
  // If we need to pit, use the calculated optimal pit lap
  // Otherwise, use middle third of race as general guidance
  let optimalPitStart: number;
  let optimalPitEnd: number;

  if (needsPit && optimalPitLap > 0) {
    // Center window around calculated optimal pit lap (±3 laps)
    optimalPitStart = Math.max(1, optimalPitLap - 3);
    optimalPitEnd = Math.min(raceDuration, optimalPitLap + 3);
  } else {
    // Use middle third of race as general pit window
    optimalPitStart = Math.floor(raceDuration * 0.33);
    optimalPitEnd = Math.floor(raceDuration * 0.66);
  }

  const inOptimalWindow = currentLap >= optimalPitStart && currentLap <= optimalPitEnd;

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

  // Estimate staying out vs pitting now
  const stayingOutTimeGain = lapsUntilOptimalPit > 0
    ? lapsUntilOptimalPit * 0.5 // Assume 0.5s/lap degradation
    : 0;

  const pittingNowLoss = pitStopTimeLoss;
  const pittingLaterLoss = pitStopTimeLoss + stayingOutTimeGain;

  // Strategy recommendations (for additional info only)
  const recommendations: {
    type: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
  }[] = [];

  if (undercutOpportunity && needsPit) {
    recommendations.push({
      type: 'undercut',
      severity: 'info',
      title: 'Undercut Opportunity',
      description: `${undercutTargets.length} car(s) ahead within 3s. Consider pitting 2-3 laps early.`,
    });
  }

  if (inOptimalWindow && !needsPit) {
    recommendations.push({
      type: 'window',
      severity: 'info',
      title: 'In Optimal Pit Window',
      description: `Currently in optimal pit window (laps ${optimalPitStart}-${optimalPitEnd}). Not required to pit.`,
    });
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-500/10';
      case 'warning':
        return 'border-yellow-500 bg-yellow-500/10';
      case 'info':
        return 'border-blue-500 bg-blue-500/10';
      default:
        return 'border-gray-500 bg-gray-500/10';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '⚠️';
      case 'warning':
        return '⚡';
      case 'info':
        return 'ℹ️';
      default:
        return '•';
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Race Strategy & Pit Decision</h3>
        <div className={`text-xs px-2 py-1 rounded-full ${
          useBackendStrategy
            ? 'bg-green-500/10 text-green-500 border border-green-500/20'
            : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
        }`}>
          {useBackendStrategy ? '🔗 Backend' : '💻 Local'}
        </div>
      </div>

      <div className="space-y-6">
        {/* Pit Window Status */}
        <div>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">Pit Window</div>
          <div className="rounded-lg bg-secondary p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">Optimal Window</span>
                <span className="font-mono text-lg font-bold">
                  Laps {optimalPitStart}-{optimalPitEnd}
                </span>
              </div>
              <div className="flex flex-col gap-1 text-right">
                <span className="text-sm text-muted-foreground">Current Lap</span>
                <span className="font-mono text-lg font-bold text-primary">
                  {currentLap}
                </span>
              </div>
            </div>
            <div className="relative">
              <div className="h-3 w-full overflow-hidden rounded-full bg-background">
                <div className="flex h-full">
                  {/* Before window */}
                  <div
                    className="bg-gray-500/50"
                    style={{ width: `${Math.max(0, (optimalPitStart / raceDuration) * 100)}%` }}
                  />
                  {/* Optimal window */}
                  <div
                    className="bg-green-500"
                    style={{
                      width: `${Math.max(0, ((optimalPitEnd - optimalPitStart) / raceDuration) * 100)}%`,
                    }}
                  />
                  {/* After window */}
                  <div
                    className="bg-gray-500/50"
                    style={{ width: `${Math.max(0, ((raceDuration - optimalPitEnd) / raceDuration) * 100)}%` }}
                  />
                </div>
              </div>
              {/* Current lap indicator */}
              <div
                className="absolute top-0 h-3 w-1 bg-primary shadow-lg rounded transition-all"
                style={{
                  left: `${Math.min(100, Math.max(0, (currentLap / raceDuration) * 100))}%`,
                  transform: 'translateX(-50%)',
                }}
              />
            </div>
            <div className="mt-3 flex justify-between text-xs text-muted-foreground">
              <span>Lap 1</span>
              {inOptimalWindow ? (
                <span className="text-green-500 font-semibold">✓ In Optimal Window</span>
              ) : currentLap < optimalPitStart ? (
                <span className="text-blue-500">Before Window</span>
              ) : (
                <span className="text-yellow-500">Past Window</span>
              )}
              <span>Lap {raceDuration}</span>
            </div>
            {needsPit && optimalPitLap > 0 && (
              <div className="mt-3 rounded-lg bg-orange-500/10 border border-orange-500/20 p-2">
                <div className="text-xs text-center">
                  <span className="text-muted-foreground">Recommended pit on </span>
                  <span className="font-mono font-semibold text-orange-500">Lap {optimalPitLap}</span>
                  <span className="text-muted-foreground"> ({lapsUntilOptimalPit > 0 ? `in ${lapsUntilOptimalPit} laps` : 'overdue'})</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Can Finish Status - Dimmed if pit required */}
        <div className={`rounded-lg border-2 p-4 transition-all ${
          needsPit ? 'opacity-30 border-green-500/30 bg-green-500/5' : 'opacity-100 border-green-500 bg-green-500/10'
        }`}>
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

        {/* Pit Stop Required - Dimmed if not needed */}
        <div className={`rounded-lg border-2 p-4 transition-all ${
          needsPit ? 'opacity-100 border-orange-500 bg-orange-500/10' : 'opacity-30 border-orange-500/30 bg-orange-500/5'
        }`}>
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

        {/* Time Analysis - Only show if pit needed */}
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

        {/* Traffic - Always show */}
        <div>
          <div className="mb-3 text-xs font-semibold text-muted-foreground">
            Traffic Situation
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-secondary p-3">
              <div className="text-xs text-muted-foreground">Cars Ahead</div>
              <div className="mt-1 text-2xl font-bold">{carsAhead.length}</div>
              <div className="text-xs text-muted-foreground">within 5s</div>
            </div>
            <div className="rounded-lg bg-secondary p-3">
              <div className="text-xs text-muted-foreground">Cars Behind</div>
              <div className="mt-1 text-2xl font-bold">{carsBehind.length}</div>
              <div className="text-xs text-muted-foreground">within 5s</div>
            </div>
          </div>
        </div>

        {/* Pit Stop Checklist - Only show if pit needed */}
        {needsPit && (
          <div>
            <div className="mb-3 text-xs font-semibold text-muted-foreground">
              What Should Be Changed?
            </div>
            <div className="space-y-3">
              {/* Fuel */}
              <div className={`rounded-lg border-2 p-3 ${
                needsPitForFuel
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-gray-500/30 bg-gray-500/5'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center ${
                    needsPitForFuel ? 'bg-red-500' : 'bg-gray-500'
                  }`}>
                    {needsPitForFuel && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                  <div className="flex-1">
                    <div className={`text-sm font-semibold ${needsPitForFuel ? 'text-red-500' : 'text-muted-foreground'}`}>
                      Fuel: {needsPitForFuel ? 'REQUIRED' : 'Optional'}
                    </div>
                    {needsPitForFuel ? (
                      <div className="mt-1 space-y-1">
                        <div className="text-sm text-muted-foreground">
                          Add <span className="font-mono font-bold text-foreground">{fuelToAdd.toFixed(1)}L</span> fuel
                        </div>
                        {pitStopsNeeded > 0 && (
                          <div className="text-xs font-semibold text-amber-500">
                            {pitStopsNeeded} pit stop{pitStopsNeeded > 1 ? 's' : ''} needed
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {isUnlimitedSession
                            ? `(${lapsPerStop[0] || 0} laps per tank)`
                            : pitStopsNeeded > 1
                              ? `(~${lapsPerStop.filter(l => l > 0).join(', ')} laps per stint)`
                              : `(Enough for ${raceLapsRemaining} laps + 2 lap safety margin)`
                          }
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 text-sm text-muted-foreground">
                        Current fuel sufficient {isUnlimitedSession ? 'for session' : 'to finish'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tires */}
              <div className={`rounded-lg border-2 p-3 ${
                needsPitForTires
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-gray-500/30 bg-gray-500/5'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center ${
                    needsPitForTires ? 'bg-red-500' : 'bg-gray-500'
                  }`}>
                    {needsPitForTires && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                  <div className="flex-1">
                    <div className={`text-sm font-semibold ${needsPitForTires ? 'text-red-500' : 'text-muted-foreground'}`}>
                      Tires: {needsPitForTires ? 'REQUIRED' : 'Optional'}
                    </div>
                    <div className="mt-1 space-y-1">
                      <div className="text-sm text-muted-foreground">
                        Current health: <span className={`font-mono font-bold ${
                          tireHealth > 50 ? 'text-green-500' :
                          tireHealth > 30 ? 'text-yellow-500' :
                          'text-red-500'
                        }`}>{tireHealth.toFixed(0)}%</span>
                      </div>
                      {needsPitForTires && (
                        <div className="text-xs text-muted-foreground">
                          {tireHealth < 20
                            ? 'Critical wear - change immediately!'
                            : 'High wear - change on this pit stop'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Damage */}
              <div className="rounded-lg border-2 border-gray-500/30 bg-gray-500/5 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center bg-gray-500">
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-muted-foreground">
                      Damage: Check if needed
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Repair any damage while in the pits
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Strategy Opportunities from Backend */}
        {useBackendStrategy && backendStrategy.opportunities && backendStrategy.opportunities.length > 0 && (
          <div>
            <div className="mb-3 text-xs font-semibold text-muted-foreground">
              Strategic Opportunities
            </div>
            <div className="space-y-3">
              {backendStrategy.opportunities.map((opportunity, idx) => {
                const severityColors = {
                  low: 'border-blue-500/30 bg-blue-500/5',
                  medium: 'border-yellow-500/30 bg-yellow-500/10',
                  high: 'border-orange-500/30 bg-orange-500/10',
                  critical: 'border-red-500/30 bg-red-500/10',
                };
                const severityIcons = {
                  low: 'ℹ️',
                  medium: '⚡',
                  high: '⚠️',
                  critical: '🚨',
                };

                return (
                  <div
                    key={idx}
                    className={`rounded-lg border-2 p-4 ${severityColors[opportunity.severity]}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{severityIcons[opportunity.severity]}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-sm">{opportunity.title}</div>
                          <div className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border">
                            {opportunity.type.replace('_', ' ')}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          {opportunity.description}
                        </div>
                        <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
                          <div className="text-xs font-semibold text-foreground">
                            Action Required:
                          </div>
                          <div className="text-sm">{opportunity.actionRequired}</div>
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <div>
                              <div className="text-xs text-muted-foreground">Optimal Timing</div>
                              <div className="text-sm font-mono font-semibold">
                                Lap {opportunity.timing.optimal}
                              </div>
                            </div>
                            {opportunity.expectedGain && (
                              <div>
                                <div className="text-xs text-muted-foreground">Expected Gain</div>
                                <div className="text-sm font-semibold text-green-500">
                                  {opportunity.expectedGain.toFixed(1)}s
                                </div>
                              </div>
                            )}
                          </div>
                          {opportunity.risk && (
                            <div className="mt-2 text-xs text-red-400">
                              ⚠️ Risk: {opportunity.risk}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Additional Recommendations (Local Fallback) */}
        {!useBackendStrategy && recommendations.length > 0 && (
          <div>
            <div className="mb-3 text-xs font-semibold text-muted-foreground">
              Additional Recommendations
            </div>
            <div className="space-y-2">
              {recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border p-4 ${getSeverityColor(rec.severity)}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{getSeverityIcon(rec.severity)}</span>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{rec.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{rec.description}</div>
                    </div>
                  </div>
                </div>
              ))}
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
              {fuelPerLap > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {fuelPerLap.toFixed(2)}L/lap
                </div>
              )}
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
                {isUnlimitedSession ? 'Unlimited' : raceLapsRemaining}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
