'use client';

import { useRef, useEffect } from 'react';

interface ShiftLightsProps {
  rpm: number;
  maxRpm: number;
  /** RPM threshold to start lighting LEDs (default: 70% of max) */
  threshold?: number;
  width?: number;
  height?: number;
}

const LED_COUNT = 12;
const LED_COLORS = [
  '#22c55e', '#22c55e', '#22c55e', '#22c55e', // green
  '#eab308', '#eab308', '#eab308', '#eab308', // yellow
  '#ef4444', '#ef4444',                         // red
  '#3b82f6', '#3b82f6',                         // blue (flash)
];

export function ShiftLights({ rpm, maxRpm, threshold, width = 200, height = 16 }: ShiftLightsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef(false);
  const startThreshold = threshold ?? maxRpm * 0.7;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const ledW = (width - (LED_COUNT - 1) * 3) / LED_COUNT;
    const rpmRange = maxRpm - startThreshold;
    const activeLeds = rpmRange > 0
      ? Math.round(((rpm - startThreshold) / rpmRange) * LED_COUNT)
      : 0;
    const clampedActive = Math.max(0, Math.min(LED_COUNT, activeLeds));

    // Flash all blue when at max
    const isFlashing = clampedActive >= LED_COUNT;
    if (isFlashing) {
      flashRef.current = !flashRef.current;
    }

    for (let i = 0; i < LED_COUNT; i++) {
      const x = i * (ledW + 3);
      const isActive = i < clampedActive;
      const isFlashOff = isFlashing && flashRef.current;

      ctx.beginPath();
      ctx.roundRect(x, 2, ledW, height - 4, 3);

      if (isActive && !isFlashOff) {
        ctx.fillStyle = LED_COLORS[i];
        ctx.shadowColor = LED_COLORS[i];
        ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = '#1f2937';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, [rpm, maxRpm, startThreshold, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="block"
    />
  );
}
