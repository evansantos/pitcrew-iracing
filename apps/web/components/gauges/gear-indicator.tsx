'use client';

import { useRef, useEffect, useState } from 'react';

interface GearIndicatorProps {
  gear: number;
  rpm: number;
  maxRpm?: number;
  size?: number;
}

function formatGear(gear: number): string {
  if (gear === -1) return 'R';
  if (gear === 0) return 'N';
  return gear.toString();
}

export function GearIndicator({ gear, rpm, maxRpm = 9000, size = 120 }: GearIndicatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [displayGear, setDisplayGear] = useState(gear);

  // Instant gear change (no smoothing)
  useEffect(() => {
    setDisplayGear(gear);
  }, [gear]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;

    ctx.clearRect(0, 0, size, size);

    // RPM-based border color
    const rpmPct = Math.min(rpm / maxRpm, 1);
    let borderColor: string;
    if (rpmPct > 0.95) {
      borderColor = '#ef4444'; // red - shift!
    } else if (rpmPct > 0.85) {
      borderColor = '#eab308'; // yellow
    } else {
      borderColor = '#374151'; // gray
    }

    // Draw circle border
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Fill
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
    ctx.fillStyle = '#111827';
    ctx.fill();

    // Flash effect at high RPM
    if (rpmPct > 0.95) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      ctx.fill();
    }

    // Gear number
    const gearText = formatGear(displayGear);
    ctx.fillStyle = rpmPct > 0.95 ? '#ef4444' : '#ffffff';
    ctx.font = `bold ${Math.round(size * 0.45)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gearText, cx, cy);

    // Label
    ctx.fillStyle = '#6b7280';
    ctx.font = `${Math.round(size * 0.1)}px sans-serif`;
    ctx.fillText('GEAR', cx, cy + size * 0.3);

  }, [displayGear, rpm, maxRpm, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="block"
    />
  );
}
