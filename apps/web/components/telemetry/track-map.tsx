'use client';

import { useTelemetryStore } from '@/stores/telemetry-store';
import { normalizeTelemetryData } from '@/lib/telemetry-utils';
import { useEffect, useRef } from 'react';

interface CarPosition {
  carIdx: number;
  position: number;
  carNumber: string;
  driverName: string;
  lapDistPct: number;
  isPlayer: boolean;
}

export function TrackMap() {
  const rawData = useTelemetryStore((state) => state.data);
  const isLive = useTelemetryStore((state) => state.isLive);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const data = normalizeTelemetryData(rawData);

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const size = canvas.width;
    const centerX = size / 2;
    const centerY = size / 2;
    const trackRadius = size * 0.35;
    const carDotRadius = 6;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw track outline (circular for now)
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 40;
    ctx.beginPath();
    ctx.arc(centerX, centerY, trackRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw start/finish line
    const startAngle = -Math.PI / 2; // Top of circle
    const startX = centerX + Math.cos(startAngle) * (trackRadius - 25);
    const startY = centerY + Math.sin(startAngle) * (trackRadius - 25);
    const endX = centerX + Math.cos(startAngle) * (trackRadius + 25);
    const endY = centerY + Math.sin(startAngle) * (trackRadius + 25);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Add "S/F" label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('S/F', centerX, centerY - trackRadius - 15);

    // Collect all car positions
    const cars: CarPosition[] = [];

    // Add player
    if (data.player && data.player.lapDistPct !== undefined) {
      cars.push({
        carIdx: -1,
        position: data.player.position,
        carNumber: 'YOU',
        driverName: 'You',
        lapDistPct: data.player.lapDistPct,
        isPlayer: true,
      });
    }

    // Add opponents
    if (data.opponents && data.opponents.length > 0) {
      data.opponents.forEach((opp: any) => {
        cars.push({
          carIdx: opp.carIdx,
          position: opp.position,
          carNumber: opp.carNumber,
          driverName: opp.driverName,
          lapDistPct: opp.lapDistPct,
          isPlayer: false,
        });
      });
    }

    // Add drivers (spectating mode)
    if (data.drivers && data.drivers.length > 0) {
      data.drivers.forEach((driver: any) => {
        if (driver.lapDistPct !== undefined) {
          cars.push({
            carIdx: driver.carIdx,
            position: driver.position,
            carNumber: driver.carNumber,
            driverName: driver.driverName,
            lapDistPct: driver.lapDistPct,
            isPlayer: driver.isPlayer || false,
          });
        }
      });
    }

    // Draw all cars
    cars.forEach((car) => {
      // Convert lapDistPct to angle (starts at top, goes clockwise)
      const angle = startAngle + (car.lapDistPct * Math.PI * 2);
      const x = centerX + Math.cos(angle) * trackRadius;
      const y = centerY + Math.sin(angle) * trackRadius;

      if (car.isPlayer) {
        // Player car - larger with bright green glow
        ctx.beginPath();
        ctx.arc(x, y, carDotRadius + 2, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Add border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw "YOU" label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('YOU', x, y);

        // Draw position indicator above
        if (car.position > 0) {
          ctx.fillStyle = '#22c55e';
          ctx.font = 'bold 16px sans-serif';
          ctx.fillText(`P${car.position}`, x, y - carDotRadius - 16);
        }
      } else {
        // Opponent cars - blue/cyan with glow
        ctx.beginPath();
        ctx.arc(x, y, carDotRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#3b82f6';
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Add border
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw car number
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(car.carNumber, x, y);

        // Draw position indicator above opponent
        if (car.position > 0) {
          ctx.fillStyle = '#93c5fd';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(`P${car.position}`, x, y - carDotRadius - 12);
        }
      }
    });

    // Draw legend
    ctx.textAlign = 'left';
    ctx.font = '11px sans-serif';

    // Player legend
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(15, size - 35, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('You', 25, size - 32);

    // Opponents legend
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(15, size - 18, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('Opponents', 25, size - 15);

    // Draw car count
    ctx.textAlign = 'right';
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${cars.length} cars`, size - 10, size - 15);

  }, [data]);

  if (!isLive || !data) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Track Map</h3>
        <div className="flex items-center justify-center h-[400px]">
          <p className="text-sm text-muted-foreground">Waiting for track data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Track Map</h3>
      <div className="flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="max-w-full"
        />
      </div>
    </div>
  );
}
