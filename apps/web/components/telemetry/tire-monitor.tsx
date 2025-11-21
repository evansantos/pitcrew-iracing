'use client';

import { useTelemetryStore } from '@/stores/telemetry-store';
import { normalizeTelemetryData, isSpectatingMode } from '@/lib/telemetry-utils';

export function TireMonitor() {
  const rawData = useTelemetryStore((state) => state.data);
  const isLive = useTelemetryStore((state) => state.isLive);

  const data = normalizeTelemetryData(rawData);

  if (!isLive || !data || !data.tires) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Tire Monitor</h3>
        <p className="text-sm text-muted-foreground">Waiting for tire data...</p>
      </div>
    );
  }

  const spectating = isSpectatingMode(rawData);

  // In spectating mode, tire data is not available
  if (spectating) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Tire Monitor</h3>
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            👁️ Spectating Mode - Tire data not available
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Driver needs to run relay server for real-time tire monitoring.
          </p>
        </div>
      </div>
    );
  }

  const getTempColor = (temp: number): string => {
    if (temp < 80) return 'bg-blue-500';
    if (temp < 90) return 'bg-green-500';
    if (temp < 100) return 'bg-yellow-500';
    if (temp < 110) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getWearColor = (wear: number): string => {
    if (wear > 0.9) return 'bg-green-500';
    if (wear > 0.7) return 'bg-yellow-500';
    if (wear > 0.5) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">Tire Monitor</h3>

      {/* Tire Layout */}
      <div className="relative mx-auto max-w-md">
        {/* Front Tires */}
        <div className="mb-8 grid grid-cols-2 gap-8">
          {/* Left Front */}
          <TireDisplay
            label="LF"
            tire={data.tires.lf}
            getTempColor={getTempColor}
            getWearColor={getWearColor}
          />
          {/* Right Front */}
          <TireDisplay
            label="RF"
            tire={data.tires.rf}
            getTempColor={getTempColor}
            getWearColor={getWearColor}
          />
        </div>

        {/* Car Body Indicator */}
        <div className="mx-auto mb-8 h-12 w-32 rounded-lg bg-secondary/50" />

        {/* Rear Tires */}
        <div className="grid grid-cols-2 gap-8">
          {/* Left Rear */}
          <TireDisplay
            label="LR"
            tire={data.tires.lr}
            getTempColor={getTempColor}
            getWearColor={getWearColor}
          />
          {/* Right Rear */}
          <TireDisplay
            label="RR"
            tire={data.tires.rr}
            getTempColor={getTempColor}
            getWearColor={getWearColor}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 space-y-3 border-t pt-4">
        <div className="text-xs font-semibold text-muted-foreground">Temperature Scale</div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-xs">Cold</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-xs">Optimal</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <span className="text-xs">Warm</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-orange-500" />
            <span className="text-xs">Hot</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-xs">Critical</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TireDisplayProps {
  label: string;
  tire: {
    tempL: number;
    tempM: number;
    tempR: number;
    wearL: number;
    wearM: number;
    wearR: number;
    avgTemp: number;
    avgWear: number;
  };
  getTempColor: (temp: number) => string;
  getWearColor: (wear: number) => string;
}

function TireDisplay({ label, tire, getTempColor, getWearColor }: TireDisplayProps) {
  return (
    <div className="space-y-2">
      {/* Tire Label */}
      <div className="text-center text-xs font-semibold text-muted-foreground">{label}</div>

      {/* Tire Visual */}
      <div className="rounded-lg border-2 border-primary/20 bg-secondary p-2">
        {/* Temperature Sections */}
        <div className="mb-2 flex gap-0.5">
          <div className="flex-1">
            <div className={`h-12 rounded-l ${getTempColor(tire.tempL)}`} />
            <div className="mt-1 text-center text-xs font-mono">{Math.round(tire.tempL)}°</div>
          </div>
          <div className="flex-1">
            <div className={`h-12 ${getTempColor(tire.tempM)}`} />
            <div className="mt-1 text-center text-xs font-mono font-semibold">
              {Math.round(tire.tempM)}°
            </div>
          </div>
          <div className="flex-1">
            <div className={`h-12 rounded-r ${getTempColor(tire.tempR)}`} />
            <div className="mt-1 text-center text-xs font-mono">{Math.round(tire.tempR)}°</div>
          </div>
        </div>

        {/* Wear Indicator */}
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Wear</div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-background">
            <div
              className={`h-full ${getWearColor(tire.avgWear)} transition-all`}
              style={{ width: `${tire.avgWear * 100}%` }}
            />
          </div>
          <div className="text-center text-xs font-mono">{(tire.avgWear * 100).toFixed(0)}%</div>
        </div>
      </div>
    </div>
  );
}
