'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface TracePoint {
  x: number; // track position (0-1) or time
  speed: number;
  throttle: number;
  brake: number;
}

interface TelemetryTracesProps {
  /** Telemetry data points */
  data: TracePoint[];
  /** X-axis mode */
  xMode?: 'position' | 'time';
}

interface TraceConfig {
  key: keyof Omit<TracePoint, 'x'>;
  label: string;
  color: string;
  max: number;
  unit: string;
}

const TRACES: TraceConfig[] = [
  { key: 'speed', label: 'Speed', color: '#3b82f6', max: 300, unit: 'km/h' },
  { key: 'throttle', label: 'Throttle', color: '#22c55e', max: 1, unit: '%' },
  { key: 'brake', label: 'Brake', color: '#ef4444', max: 1, unit: '%' },
];

export function TelemetryTraces({ data, xMode = 'position' }: TelemetryTracesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enabledTraces, setEnabledTraces] = useState<Set<string>>(
    new Set(['speed', 'throttle', 'brake'])
  );
  const [viewRange, setViewRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: 1,
  });
  const [hoveredX, setHoveredX] = useState<number | null>(null);

  const toggleTrace = (key: string) => {
    setEnabledTraces((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Reset zoom
  const resetZoom = () => setViewRange({ start: 0, end: 1 });

  // Handle wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width;
    const range = viewRange.end - viewRange.start;

    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    const newRange = Math.min(1, Math.max(0.01, range * zoomFactor));

    const pivot = viewRange.start + mouseX * range;
    const newStart = Math.max(0, pivot - mouseX * newRange);
    const newEnd = Math.min(1, newStart + newRange);

    setViewRange({ start: newStart, end: newEnd });
  }, [data.length, viewRange]);

  // Attach wheel handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Handle mouse move for hover tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width;
    const x = viewRange.start + mouseX * (viewRange.end - viewRange.start);
    setHoveredX(x);
  }, [data.length, viewRange]);

  // Find data point closest to hovered X
  const hoveredPoint = hoveredX !== null ? findClosest(data, hoveredX) : null;

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);

    const padding = { top: 10, right: 10, bottom: 25, left: 45 };
    const w = displayWidth - padding.left - padding.right;
    const h = displayHeight - padding.top - padding.bottom;

    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Background
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Grid lines
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i / 4) * h;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + w, y);
      ctx.stroke();
    }

    // Filter data to view range
    const xMin = data.length > 0 ? Math.min(...data.map(d => d.x)) : 0;
    const xMax = data.length > 0 ? Math.max(...data.map(d => d.x)) : 1;
    const xRange = xMax - xMin || 1;
    const viewStart = xMin + viewRange.start * xRange;
    const viewEnd = xMin + viewRange.end * xRange;

    // Draw each enabled trace
    for (const trace of TRACES) {
      if (!enabledTraces.has(trace.key)) continue;

      ctx.beginPath();
      ctx.strokeStyle = trace.color;
      ctx.lineWidth = 1.5;

      let started = false;
      for (const point of data) {
        if (point.x < viewStart || point.x > viewEnd) continue;

        const px = padding.left + ((point.x - viewStart) / (viewEnd - viewStart)) * w;
        const value = point[trace.key] as number;
        const py = padding.top + h - (value / trace.max) * h;

        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    }

    // Hover line
    if (hoveredX !== null && hoveredX >= viewRange.start && hoveredX <= viewRange.end) {
      const hx = padding.left + ((hoveredX - viewRange.start) / (viewRange.end - viewRange.start)) * w;
      ctx.beginPath();
      ctx.moveTo(hx, padding.top);
      ctx.lineTo(hx, padding.top + h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // X-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
      const val = viewStart + (i / 5) * (viewEnd - viewStart);
      const px = padding.left + (i / 5) * w;
      const label = xMode === 'position' ? `${(val * 100).toFixed(0)}%` : `${val.toFixed(1)}s`;
      ctx.fillText(label, px, displayHeight - 5);
    }

  }, [data, enabledTraces, viewRange, hoveredX, xMode]);

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Telemetry Traces</h2>
        <div className="flex items-center gap-2">
          {viewRange.start > 0 || viewRange.end < 1 ? (
            <button
              onClick={resetZoom}
              className="rounded px-2 py-1 text-xs bg-secondary text-secondary-foreground"
            >
              Reset Zoom
            </button>
          ) : null}
        </div>
      </div>

      {/* Trace toggles */}
      <div className="mb-3 flex gap-4">
        {TRACES.map((trace) => (
          <button
            key={trace.key}
            onClick={() => toggleTrace(trace.key)}
            className={`flex items-center gap-2 text-sm ${
              enabledTraces.has(trace.key) ? 'opacity-100' : 'opacity-40'
            }`}
          >
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: trace.color }}
            />
            {trace.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredX(null)}
          className="h-48 w-full cursor-crosshair rounded"
          style={{ background: '#0a0f1a' }}
        />

        {/* Hover tooltip */}
        {hoveredPoint && (
          <div className="absolute top-2 right-2 rounded bg-black/80 px-3 py-2 text-xs">
            {enabledTraces.has('speed') && (
              <div className="text-blue-400">Speed: {Math.round(hoveredPoint.speed)} km/h</div>
            )}
            {enabledTraces.has('throttle') && (
              <div className="text-green-400">Throttle: {Math.round(hoveredPoint.throttle * 100)}%</div>
            )}
            {enabledTraces.has('brake') && (
              <div className="text-red-400">Brake: {Math.round(hoveredPoint.brake * 100)}%</div>
            )}
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Scroll to zoom. {data.length.toLocaleString()} data points.
      </p>
    </div>
  );
}

function findClosest(data: TracePoint[], x: number): TracePoint | null {
  if (data.length === 0) return null;
  let closest = data[0];
  let minDist = Math.abs(data[0].x - x);
  for (const point of data) {
    const dist = Math.abs(point.x - x);
    if (dist < minDist) {
      minDist = dist;
      closest = point;
    }
  }
  return closest;
}
