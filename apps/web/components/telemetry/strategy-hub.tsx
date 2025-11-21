'use client';

import { Strategy } from './strategy';
import { FuelManagement } from './fuel-management';
import { TireMonitor } from './tire-monitor';
import { TireStrategy } from './tire-strategy';

export function StrategyHub() {
  return (
    <div className="space-y-6">
      {/* Row 1: Fuel Management & Tire Monitor */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-6 text-xl font-bold">Race Strategy & Resources</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="break-inside-avoid">
            <FuelManagement />
          </div>
          <div className="break-inside-avoid">
            <TireMonitor />
          </div>
        </div>
      </div>

      {/* Row 2: Race Strategy & Pit Decision (Merged) | Tire Strategy */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="break-inside-avoid">
          <Strategy />
        </div>
        <div className="break-inside-avoid">
          <TireStrategy />
        </div>
      </div>
    </div>
  );
}
