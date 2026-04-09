import { useMemo } from 'react';
import { useTelemetryStore } from '@/stores/telemetry-store';

export type AlertLevel = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  level: AlertLevel;
  message: string;
  color: string;
  pulse: boolean;
  /** Which dashboard panels this alert applies to */
  panels: string[];
}

export function useAlerts(): Alert[] {
  const data = useTelemetryStore((s) => s.data);

  return useMemo(() => {
    if (!data) return [];

    const alerts: Alert[] = [];
    const fuel = data.fuel;
    const tires = data.tires;
    const session = data.session;

    // Fuel alerts
    if (fuel?.lapsRemaining !== undefined) {
      if (fuel.lapsRemaining < 3 && fuel.lapsRemaining > 0) {
        alerts.push({
          id: 'fuel-critical',
          level: 'critical',
          message: `FUEL CRITICAL: ${fuel.lapsRemaining.toFixed(1)} laps`,
          color: '#ef4444',
          pulse: true,
          panels: ['fuel', 'strategy'],
        });
      } else if (fuel.lapsRemaining < 5 && fuel.lapsRemaining > 0) {
        alerts.push({
          id: 'fuel-low',
          level: 'warning',
          message: `Low fuel: ${fuel.lapsRemaining.toFixed(1)} laps`,
          color: '#f59e0b',
          pulse: false,
          panels: ['fuel'],
        });
      }
    }

    // Tire alerts — support both shared TireData (avgWear) and relay TireCorner (wear)
    if (tires) {
      const getWear = (tire: Record<string, unknown> | undefined): number =>
        (tire?.avgWear as number) ?? (tire?.wear as number) ?? 1;
      const avgWear = (getWear(tires.lf as unknown as Record<string, unknown>) +
                       getWear(tires.rf as unknown as Record<string, unknown>) +
                       getWear(tires.lr as unknown as Record<string, unknown>) +
                       getWear(tires.rr as unknown as Record<string, unknown>)) / 4;
      const wearPct = avgWear * 100;

      if (wearPct < 20) {
        alerts.push({
          id: 'tire-critical',
          level: 'critical',
          message: `TIRES CRITICAL: ${wearPct.toFixed(0)}%`,
          color: '#ef4444',
          pulse: true,
          panels: ['tires', 'strategy'],
        });
      } else if (wearPct < 30) {
        alerts.push({
          id: 'tire-warning',
          level: 'warning',
          message: `Tire wear: ${wearPct.toFixed(0)}%`,
          color: '#f59e0b',
          pulse: false,
          panels: ['tires'],
        });
      }
    }

    // Flag alerts
    if (session?.flags) {
      const flags = session.flags;
      if (flags & 0x00000008) {
        alerts.push({ id: 'flag-yellow', level: 'warning', message: 'YELLOW FLAG', color: '#eab308', pulse: false, panels: ['session'] });
      }
      if (flags & 0x00000010) {
        alerts.push({ id: 'flag-red', level: 'critical', message: 'RED FLAG', color: '#ef4444', pulse: true, panels: ['session'] });
      }
      if (flags & 0x00000020) {
        alerts.push({ id: 'flag-blue', level: 'info', message: 'BLUE FLAG', color: '#3b82f6', pulse: true, panels: ['session'] });
      }
    }

    return alerts;
  }, [data]);
}

/** Get the highest-priority alert color for a panel */
export function useAlertColor(panelId: string): { color: string; pulse: boolean } | null {
  const alerts = useAlerts();
  const match = alerts.find((a) => a.panels.includes(panelId));
  if (!match) return null;
  return { color: match.color, pulse: match.pulse };
}
