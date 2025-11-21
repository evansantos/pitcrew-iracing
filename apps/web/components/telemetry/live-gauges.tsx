'use client';

import { useTelemetryStore } from '@/stores/telemetry-store';
import { normalizeTelemetryData, isSpectatingMode } from '@/lib/telemetry-utils';

export function LiveGauges() {
  const rawData = useTelemetryStore((state) => state.data);
  const isLive = useTelemetryStore((state) => state.isLive);

  const data = normalizeTelemetryData(rawData);

  if (!isLive || !data) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Live Telemetry</h3>
        <p className="text-sm text-muted-foreground">Waiting for telemetry data...</p>
      </div>
    );
  }

  const spectating = isSpectatingMode(rawData);

  // Format gear display: -1 = R, 0 = N, 1+ = gear number
  const formatGear = (gear: number): string => {
    if (gear === -1) return 'R';
    if (gear === 0) return 'N';
    return gear.toString();
  };

  // In spectating mode, show limited message
  if (spectating) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Live Telemetry</h3>
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            👁️ Spectating Mode - Live telemetry not available
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Driver needs to run relay server for real-time speed, RPM, throttle, and brake data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Live Telemetry</h3>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Speed Gauge */}
        <div className="flex flex-col items-center">
          <div className="relative h-32 w-32">
            <CircularGauge value={data.player.speed} max={300} label="km/h" color="blue" />
          </div>
          <div className="mt-2 text-center">
            <div className="text-3xl font-bold">{Math.round(data.player.speed)}</div>
            <div className="text-xs text-muted-foreground">SPEED (km/h)</div>
          </div>
        </div>

        {/* RPM Gauge */}
        <div className="flex flex-col items-center">
          <div className="relative h-32 w-32">
            <CircularGauge value={data.player.rpm} max={9000} label="rpm" color="red" />
          </div>
          <div className="mt-2 text-center">
            <div className="text-3xl font-bold">{Math.round(data.player.rpm)}</div>
            <div className="text-xs text-muted-foreground">RPM</div>
          </div>
        </div>

        {/* Gear Display */}
        <div className="flex flex-col items-center justify-center">
          <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-primary bg-secondary">
            <div className="text-6xl font-bold">{formatGear(data.player.gear)}</div>
          </div>
          <div className="mt-2 text-center">
            <div className="text-xs text-muted-foreground">GEAR</div>
          </div>
        </div>
      </div>

      {/* Input Bars */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span>Throttle</span>
            <span>{Math.round(data.player.throttle * 100)}%</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-green-500 transition-all duration-75"
              style={{ width: `${data.player.throttle * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span>Brake</span>
            <span>{Math.round(data.player.brake * 100)}%</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-red-500 transition-all duration-75"
              style={{ width: `${data.player.brake * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span>Clutch</span>
            <span>{Math.round(data.player.clutch * 100)}%</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-yellow-500 transition-all duration-75"
              style={{ width: `${data.player.clutch * 100}%` }}
            />
          </div>
        </div>

        {data.player.dcBrakePct > 0 && (
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span>Brake Bias</span>
              <span>{(data.player.dcBrakePct * 100).toFixed(1)}%</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-secondary relative">
              <div className="absolute left-1/2 top-0 h-full w-0.5 bg-white/30"></div>
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${data.player.dcBrakePct * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Engine Systems - Non-critical monitoring */}
      {(data.player.waterLevel > 0 || data.player.manifoldPress > 0) && (
        <div className="mt-6 border-t pt-6">
          <h4 className="mb-4 text-sm font-semibold">Engine Systems</h4>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
            {/* Water Level */}
            {data.player.waterLevel > 0 && (
              <div className="rounded-lg bg-secondary p-3">
                <div className="text-xs text-muted-foreground">Water Level</div>
                <div className="mt-1 text-lg font-bold font-mono">
                  {data.player.waterLevel.toFixed(1)}L
                </div>
              </div>
            )}

            {/* Boost/Manifold Pressure */}
            {data.player.manifoldPress > 0 && (
              <div className="rounded-lg bg-secondary p-3">
                <div className="text-xs text-muted-foreground">Boost</div>
                <div className={`mt-1 text-lg font-bold font-mono ${
                  data.player.manifoldPress > 200 ? 'text-red-500' :
                  data.player.manifoldPress > 150 ? 'text-yellow-500' :
                  'text-cyan-500'
                }`}>
                  {data.player.manifoldPress.toFixed(0)} kPa
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Push2Pass Indicator */}
      {data.player.push2PassCount > 0 && (
        <div className="mt-4 grid gap-4 grid-cols-1">
            <div className={`rounded-lg border-2 p-4 ${
              data.player.push2PassStatus
                ? 'bg-purple-500/20 border-purple-500 animate-pulse'
                : 'bg-secondary border-secondary'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`text-2xl font-bold ${
                    data.player.push2PassStatus ? 'text-purple-500' : 'text-muted-foreground'
                  }`}>
                    P2P
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Push to Pass</div>
                    <div className={`text-sm font-semibold ${
                      data.player.push2PassStatus ? 'text-purple-500' : ''
                    }`}>
                      {data.player.push2PassStatus ? 'ACTIVE' : 'Available'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Remaining</div>
                  <div className={`text-3xl font-bold font-mono ${
                    data.player.push2PassCount < 3 ? 'text-yellow-500' : 'text-green-500'
                  }`}>
                    {data.player.push2PassCount}
                  </div>
                </div>
              </div>
            </div>
          </div>
      )}

      {/* Engine Warnings */}
      {data.player.engineWarnings > 0 && (
        <div className="mt-4 rounded-lg bg-red-500/10 border-2 border-red-500 p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <p className="text-sm text-red-600 dark:text-red-400 font-semibold">
                  Engine Warning Active
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {/* Show critical values */}
                  {data.player.oilTemp > 0 && (
                    <div className="rounded bg-red-500/20 p-2">
                      <div className="text-xs text-muted-foreground">Oil Temp</div>
                      <div className={`text-lg font-bold font-mono ${
                        data.player.oilTemp > 140 ? 'text-red-500 animate-pulse' :
                        data.player.oilTemp > 120 ? 'text-yellow-500' :
                        'text-white'
                      }`}>
                        {data.player.oilTemp.toFixed(0)}°C
                      </div>
                      {data.player.oilTemp > 140 && (
                        <div className="text-xs text-red-400">Critical!</div>
                      )}
                    </div>
                  )}

                  {data.player.oilPress > 0 && (
                    <div className="rounded bg-red-500/20 p-2">
                      <div className="text-xs text-muted-foreground">Oil Press</div>
                      <div className={`text-lg font-bold font-mono ${
                        data.player.oilPress < 200 ? 'text-red-500 animate-pulse' :
                        data.player.oilPress < 300 ? 'text-yellow-500' :
                        'text-white'
                      }`}>
                        {data.player.oilPress.toFixed(0)} kPa
                      </div>
                      {data.player.oilPress < 200 && (
                        <div className="text-xs text-red-400">Too Low!</div>
                      )}
                    </div>
                  )}

                  {data.player.waterTemp > 0 && (
                    <div className="rounded bg-red-500/20 p-2">
                      <div className="text-xs text-muted-foreground">Water Temp</div>
                      <div className={`text-lg font-bold font-mono ${
                        data.player.waterTemp > 105 ? 'text-red-500 animate-pulse' :
                        data.player.waterTemp > 95 ? 'text-yellow-500' :
                        'text-white'
                      }`}>
                        {data.player.waterTemp.toFixed(0)}°C
                      </div>
                      {data.player.waterTemp > 105 && (
                        <div className="text-xs text-red-400">Overheating!</div>
                      )}
                    </div>
                  )}

                  {data.player.voltage > 0 && (
                    <div className="rounded bg-red-500/20 p-2">
                      <div className="text-xs text-muted-foreground">Voltage</div>
                      <div className={`text-lg font-bold font-mono ${
                        data.player.voltage < 12 ? 'text-red-500 animate-pulse' : 'text-white'
                      }`}>
                        {data.player.voltage.toFixed(1)}V
                      </div>
                      {data.player.voltage < 12 && (
                        <div className="text-xs text-red-400">Low Power!</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-3 text-xs text-red-400">
                  💡 Consider reducing engine load or pitting for repairs
                </div>
              </div>
            </div>
        </div>
      )}
    </div>
  );
}

interface CircularGaugeProps {
  value: number;
  max: number;
  label: string;
  color: 'blue' | 'red';
}

function CircularGauge({ value, max, color }: CircularGaugeProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const circumference = 2 * Math.PI * 45; // radius = 45
  const offset = circumference - (percentage / 100) * circumference;

  const colorMap = {
    blue: 'stroke-blue-500',
    red: 'stroke-red-500',
  };

  return (
    <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
      {/* Background circle */}
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        className="text-secondary"
      />
      {/* Progress circle */}
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        strokeWidth="8"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={`transition-all duration-100 ${colorMap[color]}`}
      />
    </svg>
  );
}
