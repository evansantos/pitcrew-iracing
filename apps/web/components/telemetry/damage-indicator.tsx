'use client';

import { useTelemetryStore } from '@/stores/telemetry-store';
import { normalizeTelemetryData } from '@/lib/telemetry-utils';

export function DamageIndicator() {
  const rawData = useTelemetryStore((state) => state.data);
  const isLive = useTelemetryStore((state) => state.isLive);

  const data = normalizeTelemetryData(rawData);

  if (!isLive || !data || !data.damage) {
    return null; // Only show if damage data is available
  }

  const { lf, rf, lr, rr } = data.damage;
  const maxDamage = Math.max(lf, rf, lr, rr);

  // Only show damage indicator if there's significant damage (>10%)
  if (maxDamage < 0.1) {
    return null;
  }

  const getDamageColor = (damage: number): string => {
    if (damage < 0.1) return 'bg-green-500';
    if (damage < 0.25) return 'bg-yellow-500';
    if (damage < 0.5) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getDamageLabel = (damage: number): string => {
    if (damage < 0.1) return 'OK';
    if (damage < 0.25) return 'Minor';
    if (damage < 0.5) return 'Moderate';
    if (damage < 0.75) return 'Severe';
    return 'Critical';
  };

  const getSeverity = (): 'ok' | 'warning' | 'critical' => {
    if (maxDamage < 0.1) return 'ok';
    if (maxDamage < 0.5) return 'warning';
    return 'critical';
  };

  const severity = getSeverity();

  return (
    <div
      className={`rounded-lg border p-6 ${
        severity === 'critical'
          ? 'border-red-500 bg-red-500/10'
          : severity === 'warning'
            ? 'border-yellow-500 bg-yellow-500/10'
            : 'border-green-500 bg-green-500/10'
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        {severity === 'critical' && <span className="text-2xl">⚠️</span>}
        {severity === 'warning' && <span className="text-2xl">⚡</span>}
        <h3 className="text-lg font-semibold">Car Damage</h3>
      </div>

      {/* Car Diagram */}
      <div className="relative mx-auto max-w-xs">
        {/* Front Corners */}
        <div className="mb-4 grid grid-cols-2 gap-8">
          {/* Left Front */}
          <div className="space-y-1">
            <div className="text-center text-xs font-semibold text-muted-foreground">LF</div>
            <div className="rounded-lg border-2 border-secondary bg-secondary/50 p-3">
              <div
                className={`h-3 rounded ${getDamageColor(lf)} transition-all`}
                style={{ width: `${lf * 100}%` }}
              />
              <div className="mt-1 text-center text-xs font-mono">
                {getDamageLabel(lf)} ({(lf * 100).toFixed(0)}%)
              </div>
            </div>
          </div>

          {/* Right Front */}
          <div className="space-y-1">
            <div className="text-center text-xs font-semibold text-muted-foreground">RF</div>
            <div className="rounded-lg border-2 border-secondary bg-secondary/50 p-3">
              <div
                className={`h-3 rounded ${getDamageColor(rf)} transition-all`}
                style={{ width: `${rf * 100}%` }}
              />
              <div className="mt-1 text-center text-xs font-mono">
                {getDamageLabel(rf)} ({(rf * 100).toFixed(0)}%)
              </div>
            </div>
          </div>
        </div>

        {/* Car Body */}
        <div className="mx-auto mb-4 h-16 w-24 rounded-lg bg-secondary/50 border-2 border-secondary flex items-center justify-center">
          <div className="text-xs text-muted-foreground">Body</div>
        </div>

        {/* Rear Corners */}
        <div className="grid grid-cols-2 gap-8">
          {/* Left Rear */}
          <div className="space-y-1">
            <div className="text-center text-xs font-semibold text-muted-foreground">LR</div>
            <div className="rounded-lg border-2 border-secondary bg-secondary/50 p-3">
              <div
                className={`h-3 rounded ${getDamageColor(lr)} transition-all`}
                style={{ width: `${lr * 100}%` }}
              />
              <div className="mt-1 text-center text-xs font-mono">
                {getDamageLabel(lr)} ({(lr * 100).toFixed(0)}%)
              </div>
            </div>
          </div>

          {/* Right Rear */}
          <div className="space-y-1">
            <div className="text-center text-xs font-semibold text-muted-foreground">RR</div>
            <div className="rounded-lg border-2 border-secondary bg-secondary/50 p-3">
              <div
                className={`h-3 rounded ${getDamageColor(rr)} transition-all`}
                style={{ width: `${rr * 100}%` }}
              />
              <div className="mt-1 text-center text-xs font-mono">
                {getDamageLabel(rr)} ({(rr * 100).toFixed(0)}%)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overall Status */}
      <div className="mt-6 rounded-lg bg-secondary p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Overall Status</span>
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${getDamageColor(maxDamage)}`} />
            <span
              className={`font-semibold ${
                severity === 'critical'
                  ? 'text-red-500'
                  : severity === 'warning'
                    ? 'text-yellow-500'
                    : 'text-green-500'
              }`}
            >
              {getDamageLabel(maxDamage)}
            </span>
          </div>
        </div>
        {severity === 'critical' && (
          <div className="mt-2 text-xs text-red-500">
            ⚠️ Severe damage detected. Consider pitting for repairs.
          </div>
        )}
        {severity === 'warning' && (
          <div className="mt-2 text-xs text-yellow-500">
            Monitor car performance. Damage may affect handling.
          </div>
        )}
      </div>
    </div>
  );
}
