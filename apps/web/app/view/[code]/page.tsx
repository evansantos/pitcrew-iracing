'use client';

import { useParams } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default function ViewerPage() {
  const params = useParams<{ code: string }>();

  return (
    <DashboardShell>
      <div className="flex flex-col gap-4">
        {/* Viewer mode indicator */}
        <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
          <span className="rounded bg-blue-500 px-2 py-0.5 text-xs font-bold text-white">
            VIEWER
          </span>
          <span className="text-sm text-muted-foreground">
            Session code: <code className="text-sm font-bold">{params.code}</code>
          </span>
          <span className="ml-auto text-xs text-muted-foreground">Read-only</span>
        </div>

        {/* Dashboard components will render here with shared telemetry */}
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-muted-foreground">
            Live telemetry viewer — same dashboard components as the driver sees,
            but in read-only mode. No strategy controls or racer selector.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Connected via Socket.IO room <code>share:{params.code}</code>.
            Full integration pending live WebSocket hookup.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
