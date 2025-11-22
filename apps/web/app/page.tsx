import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { TelemetryStatus } from '@/components/telemetry/telemetry-status';
import { RelayStatus } from '@/components/telemetry/relay-status';
import { LiveGauges } from '@/components/telemetry/live-gauges';
import { LapTimes } from '@/components/telemetry/lap-times';
import { SessionInfo } from '@/components/telemetry/session-info';
import { Opponents } from '@/components/telemetry/opponents';
import { DamageIndicator } from '@/components/telemetry/damage-indicator';
import { TrackMap } from '@/components/telemetry/track-map';
import { StrategyHub } from '@/components/telemetry/strategy-hub';
import { RaceEngineerAssistant } from '@/components/telemetry/race-engineer-assistant';

export default function Home() {
  return (
    <DashboardShell>
      <div className="flex flex-col gap-6 pb-8">
        {/* Header Section - Sticky */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b pb-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">iRacing Race Engineer</h1>
            <p className="text-sm text-muted-foreground">
              Real-time telemetry analysis and race strategy
            </p>
          </div>
          <div className="mt-4 flex gap-4">
            <div className="flex-1">
              <TelemetryStatus />
            </div>
            <RelayStatus />
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Critical Alerts - Full Width */}
          <DamageIndicator />

          {/* Row 1: Live Telemetry | Lap Times | Session | Track Map */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="break-inside-avoid">
              <LiveGauges />
            </div>
            <div className="break-inside-avoid">
              <LapTimes />
            </div>
            <div className="break-inside-avoid">
              <SessionInfo />
            </div>
            <div className="break-inside-avoid">
              <TrackMap />
            </div>
          </div>

          {/* Rows 2-3: Race Strategy & Resources (Strategy Hub handles both rows) */}
          <StrategyHub />

          {/* Row 4: Live Standings */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-6 text-xl font-bold">Live Standings</h2>
            <Opponents />
          </div>

          {/* Row 5: AI Race Engineer Assistant */}
          <RaceEngineerAssistant />
        </div>
      </div>
    </DashboardShell>
  );
}
