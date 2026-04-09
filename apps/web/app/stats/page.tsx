'use client';

import { useState, useEffect } from 'react';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

interface SessionScore {
  sessionId: string;
  trackName: string;
  carName: string;
  date: number;
  overall: number;
  consistency: number;
  racecraft: number;
  improvement: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function StatsPage() {
  const [scores, setScores] = useState<SessionScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production, this would fetch computed scores from the API
    // For now, fetch sessions and display placeholder scores
    fetch(`${API_URL}/api/sessions`)
      .then((r) => r.json())
      .then((sessions: Array<{ sessionId: string; trackName: string; carName: string; startTime: number; totalLaps: number }>) => {
        // Generate placeholder scores based on session data
        const sessionScores: SessionScore[] = sessions
          .filter(s => s.totalLaps >= 3)
          .map(s => ({
            sessionId: s.sessionId,
            trackName: s.trackName,
            carName: s.carName,
            date: s.startTime,
            overall: 0,
            consistency: 0,
            racecraft: 0,
            improvement: 0,
          }));
        setScores(sessionScores);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const latest = scores[0];

  return (
    <DashboardShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">Driver Stats</h1>

        {loading && <p className="text-muted-foreground">Loading stats...</p>}

        {/* Radar chart placeholder */}
        {latest && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Performance Radar</h2>
            <RadarChart
              data={{
                consistency: latest.consistency,
                racecraft: latest.racecraft,
                improvement: latest.improvement,
                lapControl: Math.round((latest.consistency + latest.improvement) / 2),
                overtaking: latest.racecraft,
              }}
            />
          </div>
        )}

        {/* Session history table */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Session History</h2>
          {scores.length === 0 && !loading && (
            <p className="text-muted-foreground">No sessions with 3+ laps found.</p>
          )}
          {scores.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Track</th>
                  <th className="pb-2">Car</th>
                  <th className="pb-2 text-right">Overall</th>
                  <th className="pb-2 text-right">Consistency</th>
                  <th className="pb-2 text-right">Racecraft</th>
                  <th className="pb-2 text-right">Improvement</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s) => (
                  <tr key={s.sessionId} className="border-b border-border/50">
                    <td className="py-2">{new Date(s.date).toLocaleDateString()}</td>
                    <td className="py-2">{s.trackName}</td>
                    <td className="py-2">{s.carName}</td>
                    <td className="py-2 text-right font-mono">{s.overall}</td>
                    <td className="py-2 text-right font-mono">{s.consistency}</td>
                    <td className="py-2 text-right font-mono">{s.racecraft}</td>
                    <td className="py-2 text-right font-mono">{s.improvement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

/** SVG radar chart with 5 axes */
function RadarChart({ data }: { data: Record<string, number> }) {
  const keys = Object.keys(data);
  const count = keys.length;
  const cx = 150;
  const cy = 150;
  const radius = 120;

  const angleStep = (2 * Math.PI) / count;

  const getPoint = (index: number, value: number) => {
    const angle = -Math.PI / 2 + index * angleStep;
    const r = (value / 100) * radius;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  // Grid rings
  const rings = [25, 50, 75, 100];

  // Data polygon
  const points = keys.map((_, i) => getPoint(i, data[keys[i]]));
  const polygonPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <div className="flex justify-center">
      <svg viewBox="0 0 300 300" className="w-72 h-72">
        {/* Grid rings */}
        {rings.map((ring) => {
          const ringPoints = Array.from({ length: count }, (_, i) => getPoint(i, ring));
          const d = ringPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
          return <path key={ring} d={d} fill="none" stroke="#374151" strokeWidth={0.5} />;
        })}

        {/* Axis lines */}
        {keys.map((_, i) => {
          const p = getPoint(i, 100);
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#374151" strokeWidth={0.5} />;
        })}

        {/* Data polygon */}
        <path d={polygonPath} fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" strokeWidth={2} />

        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill="#f59e0b" />
        ))}

        {/* Labels */}
        {keys.map((key, i) => {
          const p = getPoint(i, 115);
          return (
            <text
              key={key}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground"
              fontSize={11}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
