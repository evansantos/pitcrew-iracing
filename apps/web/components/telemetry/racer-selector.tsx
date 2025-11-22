'use client';

import { useTelemetryStore } from '@/stores/telemetry-store';

export function RacerSelector() {
  const availableRacers = useTelemetryStore((state) => state.availableRacers);
  const selectedRacer = useTelemetryStore((state) => state.selectedRacer);
  const setSelectedRacer = useTelemetryStore((state) => state.setSelectedRacer);

  if (availableRacers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
      <label htmlFor="racer-select" className="text-sm font-medium whitespace-nowrap">
        Select Racer:
      </label>
      <select
        id="racer-select"
        value={selectedRacer || ''}
        onChange={(e) => setSelectedRacer(e.target.value || null)}
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {availableRacers.map((racer) => (
          <option key={racer.name} value={racer.name}>
            {racer.name} {racer.mock ? '(Mock)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
