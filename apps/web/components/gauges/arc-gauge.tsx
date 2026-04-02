'use client';

import { useRef, useEffect, useState } from 'react';

export interface GaugeZone {
  /** Start percentage (0-100) */
  start: number;
  /** End percentage (0-100) */
  end: number;
  /** Zone color */
  color: string;
}

export interface ArcGaugeProps {
  /** Current value */
  value: number;
  /** Maximum value */
  max: number;
  /** Label text (e.g., "km/h", "RPM") */
  label: string;
  /** Gauge size in pixels */
  size?: number;
  /** Color zones */
  zones?: GaugeZone[];
  /** Format function for the value display */
  formatValue?: (value: number) => string;
  /** Needle color */
  needleColor?: string;
}

const DEFAULT_ZONES: GaugeZone[] = [
  { start: 0, end: 70, color: '#22c55e' },   // green
  { start: 70, end: 85, color: '#eab308' },   // yellow
  { start: 85, end: 100, color: '#ef4444' },  // red
];

const START_ANGLE = 0.75 * Math.PI;   // 135 degrees
const END_ANGLE = 2.25 * Math.PI;     // 405 degrees
const SWEEP = END_ANGLE - START_ANGLE; // 270 degrees

export function ArcGauge({
  value,
  max,
  label,
  size = 160,
  zones = DEFAULT_ZONES,
  formatValue = (v) => Math.round(v).toString(),
  needleColor = '#ffffff',
}: ArcGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [smoothValue, setSmoothValue] = useState(value);
  const targetRef = useRef(value);

  targetRef.current = value;

  // Smooth value interpolation via requestAnimationFrame
  useEffect(() => {
    let raf: number;
    const animate = () => {
      setSmoothValue((prev) => {
        const diff = targetRef.current - prev;
        if (Math.abs(diff) < 0.5) return targetRef.current;
        return prev + diff * 0.15; // lerp factor
      });
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Canvas rendering
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
    const outerRadius = size / 2 - 8;
    const arcWidth = 12;
    const innerRadius = outerRadius - arcWidth;

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Draw zone arcs
    for (const zone of zones) {
      const zoneStart = START_ANGLE + (zone.start / 100) * SWEEP;
      const zoneEnd = START_ANGLE + (zone.end / 100) * SWEEP;

      ctx.beginPath();
      ctx.arc(cx, cy, outerRadius - arcWidth / 2, zoneStart, zoneEnd);
      ctx.strokeStyle = zone.color;
      ctx.lineWidth = arcWidth;
      ctx.lineCap = 'butt';
      ctx.globalAlpha = 0.25;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Draw active arc (filled portion)
    const pct = Math.min(smoothValue / max, 1);
    const activeEnd = START_ANGLE + pct * SWEEP;

    // Determine active color based on current zone
    const pctHundred = pct * 100;
    let activeColor = zones[0]?.color || '#22c55e';
    for (const zone of zones) {
      if (pctHundred >= zone.start && pctHundred <= zone.end) {
        activeColor = zone.color;
        break;
      }
    }

    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius - arcWidth / 2, START_ANGLE, activeEnd);
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = arcWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Draw needle
    const needleAngle = START_ANGLE + pct * SWEEP;
    const needleLength = innerRadius - 16;
    const needleX = cx + Math.cos(needleAngle) * needleLength;
    const needleY = cy + Math.sin(needleAngle) * needleLength;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(needleX, needleY);
    ctx.strokeStyle = needleColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = needleColor;
    ctx.fill();

    // Value text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(size * 0.2)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatValue(smoothValue), cx, cy + size * 0.12);

    // Label text
    ctx.fillStyle = '#9ca3af';
    ctx.font = `${Math.round(size * 0.08)}px sans-serif`;
    ctx.fillText(label, cx, cy + size * 0.26);

  }, [smoothValue, max, size, zones, formatValue, needleColor, label]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="block"
    />
  );
}
