'use client';

import { useTelemetryStore } from '@/stores/telemetry-store';
import { normalizeTelemetryData } from '@/lib/telemetry-utils';
import { SessionState, SessionFlags } from '@iracing-race-engineer/shared';

export function SessionInfo() {
  const rawData = useTelemetryStore((state) => state.data);
  const isLive = useTelemetryStore((state) => state.isLive);

  const data = normalizeTelemetryData(rawData);

  if (!isLive || !data || !data.session || !data.track) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Session Info</h3>
        <p className="text-sm text-muted-foreground">Waiting for session data...</p>
      </div>
    );
  }

  const getSessionStateName = (state: SessionState): string => {
    switch (state) {
      case SessionState.Invalid:
        return 'Invalid';
      case SessionState.GetInCar:
        return 'Get In Car';
      case SessionState.Warmup:
        return 'Warmup';
      case SessionState.ParadeLaps:
        return 'Parade Laps';
      case SessionState.Racing:
        return 'Racing';
      case SessionState.Checkered:
        return 'Checkered';
      case SessionState.CoolDown:
        return 'Cool Down';
      default:
        return 'Unknown';
    }
  };

  const getSessionStateColor = (state: SessionState): string => {
    switch (state) {
      case SessionState.Racing:
        return 'bg-green-500';
      case SessionState.Warmup:
      case SessionState.ParadeLaps:
        return 'bg-yellow-500';
      case SessionState.Checkered:
      case SessionState.CoolDown:
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getActiveFlags = (flags: number): string[] => {
    const activeFlags: string[] = [];

    // Convert to number to ensure bitwise operations work correctly
    const flagValue = Number(flags);

    if (flagValue & SessionFlags.Checkered) activeFlags.push('Checkered');
    if (flagValue & SessionFlags.White) activeFlags.push('White');
    if (flagValue & SessionFlags.Green) activeFlags.push('Green');
    if (flagValue & SessionFlags.Yellow) activeFlags.push('Yellow');
    if (flagValue & SessionFlags.Red) activeFlags.push('Red');
    if (flagValue & SessionFlags.Blue) activeFlags.push('Blue');
    if (flagValue & SessionFlags.Debris) activeFlags.push('Debris');
    if (flagValue & SessionFlags.Caution) activeFlags.push('Caution');
    if (flagValue & SessionFlags.YellowWaving) activeFlags.push('Yellow Waving');
    if (flagValue & SessionFlags.OneLapToGreen) activeFlags.push('1 Lap to Green');
    if (flagValue & SessionFlags.GreenHeld) activeFlags.push('Green Held');
    if (flagValue & SessionFlags.CautionWaving) activeFlags.push('Caution Waving');

    return activeFlags;
  };

  const getFlagColor = (flag: string): string => {
    switch (flag) {
      case 'Green':
      case 'Green Held':
        return 'bg-green-500';
      case 'Yellow':
      case 'Caution':
      case 'Yellow Waving':
      case 'Caution Waving':
      case '1 Lap to Green':
        return 'bg-yellow-500';
      case 'Red':
        return 'bg-red-500';
      case 'White':
        return 'bg-white text-black';
      case 'Checkered':
        return 'bg-gradient-to-r from-black via-white to-black';
      case 'Blue':
        return 'bg-blue-500';
      case 'Debris':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const activeFlags = getActiveFlags(data.session.flags);
  const sessionStateName = getSessionStateName(data.session.state);
  const sessionStateColor = getSessionStateColor(data.session.state);

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Session Info</h3>

      <div className="space-y-6">
        {/* Session Type/Name */}
        {(data.session.type || data.session.name) && (
          <div>
            <div className="mb-2 text-xs text-muted-foreground">Session Type</div>
            <div className="text-xl font-bold">
              {data.session.name || data.session.type}
            </div>
          </div>
        )}

        {/* Session State */}
        <div>
          <div className="mb-2 text-xs text-muted-foreground">Session State</div>
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${sessionStateColor}`} />
            <span className="text-xl font-bold">{sessionStateName}</span>
          </div>
        </div>

        {/* Track Flags */}
        <div>
          <div className="mb-2 text-xs text-muted-foreground">Track Flags</div>
          {activeFlags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeFlags.map((flag) => (
                <div
                  key={flag}
                  className={`rounded px-3 py-1 text-sm font-semibold text-white ${getFlagColor(flag)}`}
                >
                  {flag}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active flags</p>
          )}
        </div>

        {/* Session Time */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-secondary p-4">
            <div className="text-xs text-muted-foreground">Time Remaining</div>
            <div className="mt-1 text-2xl font-bold font-mono">
              {formatTime(data.session.timeRemaining)}
            </div>
          </div>
          <div className="rounded-lg bg-secondary p-4">
            <div className="text-xs text-muted-foreground">Laps Remaining</div>
            <div className="mt-1 text-2xl font-bold">{data.session.lapsRemaining}</div>
          </div>
        </div>

        {/* Track Conditions */}
        <div className="border-t pt-4">
          <div className="mb-3 text-xs font-semibold text-muted-foreground">Track Conditions</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Track Temp</span>
              <span className="font-mono font-semibold">{(data.track.temperature || 20).toFixed(1)}°C</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Air Temp</span>
              <span className="font-mono font-semibold">{(data.track.airTemp || 20).toFixed(1)}°C</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Humidity</span>
              <span className="font-mono font-semibold">{Math.round((data.track.humidity || 50))}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Wind Speed</span>
              <span className="font-mono font-semibold">{(data.track.windSpeed || 0).toFixed(1)} m/s</span>
            </div>
          </div>
        </div>

        {/* Wind Direction Indicator */}
        {(data.track.windSpeed || 0) > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Wind Direction</span>
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <div
                className="absolute h-6 w-0.5 bg-primary"
                style={{
                  transform: `rotate(${data.track.windDirection || 0}rad)`,
                  transformOrigin: 'center',
                }}
              >
                <div className="absolute -top-1 left-1/2 h-0 w-0 -translate-x-1/2 border-l-[3px] border-r-[3px] border-b-[6px] border-l-transparent border-r-transparent border-b-primary" />
              </div>
            </div>
            <span className="font-mono text-sm">{Math.round(((data.track.windDirection || 0) * 180) / Math.PI)}°</span>
          </div>
        )}
      </div>
    </div>
  );
}
