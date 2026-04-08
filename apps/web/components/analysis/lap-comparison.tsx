'use client';

import { useState, useMemo } from 'react';

interface DeltaPoint {
  dist: number;
  delta: number;
}

interface LapOption {
  lap: number;
  lapTime: number | null;
}

interface LapComparisonProps {
  /** Available laps with their times */
  laps: LapOption[];
  /** Function to fetch delta data between two laps */
  onCompareLaps: (lap1: number, lap2: number) => Promise<DeltaPoint[]>;
}

export function LapComparison({ laps, onCompareLaps }: LapComparisonProps) {
  const [lap1, setLap1] = useState<number | null>(null);
  const [lap2, setLap2] = useState<number | null>(null);
  const [deltaData, setDeltaData] = useState<DeltaPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const handleCompare = async () => {
    if (lap1 === null || lap2 === null) return;
    setLoading(true);
    try {
      const data = await onCompareLaps(lap1, lap2);
      setDeltaData(data);
    } finally {
      setLoading(false);
    }
  };

  const maxAbsDelta = useMemo(() => {
    if (deltaData.length === 0) return 1;
    return Math.max(...deltaData.map(d => Math.abs(d.delta)), 0.1);
  }, [deltaData]);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '--:--.---';
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${secs.padStart(6, '0')}`;
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="mb-4 text-lg font-bold">Lap Comparison</h2>

      {/* Lap Selectors */}
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Lap A</label>
          <select
            className="rounded-md border bg-secondary px-3 py-1.5 text-sm"
            value={lap1 ?? ''}
            onChange={(e) => setLap1(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Select lap...</option>
            {laps.map((l) => (
              <option key={l.lap} value={l.lap}>
                Lap {l.lap} — {formatTime(l.lapTime)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Lap B (reference)</label>
          <select
            className="rounded-md border bg-secondary px-3 py-1.5 text-sm"
            value={lap2 ?? ''}
            onChange={(e) => setLap2(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Select lap...</option>
            {laps.map((l) => (
              <option key={l.lap} value={l.lap}>
                Lap {l.lap} — {formatTime(l.lapTime)}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCompare}
          disabled={lap1 === null || lap2 === null || loading}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Compare'}
        </button>
      </div>

      {/* Delta Graph */}
      {deltaData.length > 0 && (
        <DeltaGraph data={deltaData} maxDelta={maxAbsDelta} />
      )}

      {deltaData.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Select two laps and click Compare to see the time delta across the track.
        </p>
      )}
    </div>
  );
}

/** Canvas-based delta graph for performance with many data points */
function DeltaGraph({ data, maxDelta }: { data: DeltaPoint[]; maxDelta: number }) {
  const width = 800;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = data.map((d, i) => ({
    x: padding.left + (d.dist * chartW),
    y: padding.top + chartH / 2 - (d.delta / maxDelta) * (chartH / 2),
  }));

  // SVG path
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Zero line
  const zeroY = padding.top + chartH / 2;

  // Fill area (positive = red above zero, negative = green below)
  const fillAbove = `M ${padding.left} ${zeroY} ` +
    points.map(p => `L ${p.x} ${Math.min(p.y, zeroY)}`).join(' ') +
    ` L ${padding.left + chartW} ${zeroY} Z`;

  const fillBelow = `M ${padding.left} ${zeroY} ` +
    points.map(p => `L ${p.x} ${Math.max(p.y, zeroY)}`).join(' ') +
    ` L ${padding.left + chartW} ${zeroY} Z`;

  const lastDelta = data[data.length - 1]?.delta ?? 0;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-full" style={{ minWidth: 400 }}>
        {/* Fill areas */}
        <path d={fillBelow} fill="rgba(34, 197, 94, 0.15)" />
        <path d={fillAbove} fill="rgba(239, 68, 68, 0.15)" />

        {/* Zero line */}
        <line
          x1={padding.left} y1={zeroY}
          x2={padding.left + chartW} y2={zeroY}
          stroke="#6b7280" strokeWidth={1} strokeDasharray="4 4"
        />

        {/* Delta line */}
        <path d={pathD} fill="none" stroke="#ffffff" strokeWidth={2} />

        {/* X-axis labels */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <text
            key={pct}
            x={padding.left + (pct / 100) * chartW}
            y={height - 5}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={10}
          >
            {pct}%
          </text>
        ))}

        {/* Y-axis labels */}
        <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" fontSize={10} className="fill-red-400">
          +{maxDelta.toFixed(1)}s
        </text>
        <text x={padding.left - 8} y={zeroY + 4} textAnchor="end" fontSize={10} className="fill-muted-foreground">
          0.0s
        </text>
        <text x={padding.left - 8} y={padding.top + chartH + 4} textAnchor="end" fontSize={10} className="fill-green-400">
          -{maxDelta.toFixed(1)}s
        </text>

        {/* Final delta annotation */}
        <text
          x={padding.left + chartW - 5}
          y={points[points.length - 1]?.y - 8}
          textAnchor="end"
          fontSize={12}
          fontWeight="bold"
          className={lastDelta > 0 ? 'fill-red-400' : 'fill-green-400'}
        >
          {lastDelta > 0 ? '+' : ''}{lastDelta.toFixed(3)}s
        </text>
      </svg>
    </div>
  );
}
