/**
 * Terminal dashboard — live-updating stats panel.
 *
 * Writes to process.stdout using ANSI escape codes so it works with any
 * terminal that supports them (Windows Terminal, macOS Terminal, iTerm2).
 *
 * The dashboard is a fixed-height block; we move the cursor up by the block
 * height each tick and overwrite, producing a smooth in-place update.
 */

import type { DisplayState } from './types.js';

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const ESC = '\x1b[';

export const ansi = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  clearLine: `${ESC}2K`,
  cursorUp: (n: number) => `${ESC}${n}A`,
  cursorCol0: `${ESC}0G`,
};

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatSpeed(kmh: number): string {
  return `${kmh.toFixed(1).padStart(6)} km/h`;
}

export function formatRpm(rpm: number): string {
  return `${Math.round(rpm).toString().padStart(5)} RPM`;
}

export function formatFuel(litres: number): string {
  return `${litres.toFixed(1).padStart(5)}L`;
}

export function formatTemp(celsius: number): string {
  return `${celsius.toFixed(0).padStart(3)}°C`;
}

export function formatLapTime(seconds: number): string {
  if (seconds <= 0) return '--:--.---';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
}

export function formatBandwidth(bytes: number): string {
  if (bytes < 1024) return `${bytes} B/s`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB/s`;
}

export function formatGear(gear: number): string {
  if (gear === 0) return 'N';
  if (gear === -1) return 'R';
  return gear.toString();
}

/** Bar visualisation, e.g. `████░░░░░░` out of `width` chars. */
export function bar(value: number, max: number, width: number = 10): string {
  const filled = Math.round((Math.min(value, max) / max) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// ─── Dashboard renderer ───────────────────────────────────────────────────────

/** Number of lines the dashboard occupies (used for cursor gymnastics). */
export const DASHBOARD_LINES = 22;

/**
 * Build the dashboard string from the current DisplayState.
 * Returns an array of lines (without trailing newlines).
 */
export function buildDashboard(state: DisplayState): string[] {
  const t = state.telemetry;

  const statusColor = state.connected
    ? ansi.green
    : ansi.red;
  const statusLabel = state.connected
    ? '● CONNECTED'
    : '○ DISCONNECTED';
  const mockLabel = state.mockMode ? ` ${ansi.yellow}[MOCK]${ansi.reset}` : '';

  const lines: string[] = [];

  lines.push(`${ansi.bold}${ansi.cyan}╔══════════════════════════════════════════╗${ansi.reset}`);
  lines.push(`${ansi.bold}${ansi.cyan}║  iRacing Relay  —  Terminal Dashboard    ║${ansi.reset}`);
  lines.push(`${ansi.bold}${ansi.cyan}╚══════════════════════════════════════════╝${ansi.reset}`);
  lines.push('');

  // Status row
  lines.push(
    `  Status   ${statusColor}${statusLabel}${ansi.reset}${mockLabel}` +
    `   Clients: ${ansi.bold}${state.clientCount}${ansi.reset}` +
    `   Frames: ${state.frameCount}`
  );
  lines.push(`  BW Out   ${formatBandwidth(state.bytesSent)}`);
  lines.push('');

  // Session info
  lines.push(`  Track    ${ansi.bold}${state.track || '—'}${ansi.reset}`);
  lines.push(`  Car      ${ansi.bold}${state.car || '—'}${ansi.reset}`);
  lines.push('');

  if (!t) {
    lines.push(`  ${ansi.dim}No telemetry yet...${ansi.reset}`);
    // Pad to DASHBOARD_LINES
    while (lines.length < DASHBOARD_LINES) lines.push('');
    return lines;
  }

  const p = t.player;
  const f = t.fuel;
  const tr = t.tires;
  const tk = t.track;

  // Driver
  lines.push(
    `  Speed    ${ansi.bold}${formatSpeed(p.speed)}${ansi.reset}` +
    `   Gear: ${ansi.bold}${formatGear(p.gear)}${ansi.reset}` +
    `   RPM: ${formatRpm(p.rpm)}`
  );
  lines.push(
    `  Throttle ${bar(p.throttle, 1)}  ${(p.throttle * 100).toFixed(0).padStart(3)}%` +
    `   Brake ${bar(p.brake, 1)}  ${(p.brake * 100).toFixed(0).padStart(3)}%`
  );
  lines.push(
    `  Lap      ${ansi.bold}${p.lap}${ansi.reset}` +
    `   Pos: ${ansi.bold}P${p.position}${ansi.reset}` +
    `   Best: ${formatLapTime(p.bestLapTime)}` +
    `   Last: ${formatLapTime(p.lastLapTime)}`
  );
  lines.push('');

  // Fuel
  lines.push(
    `  Fuel     ${ansi.bold}${formatFuel(f.level)}${ansi.reset}` +
    `  ${bar(f.levelPct, 100)}  ${f.levelPct.toFixed(0)}%` +
    `   ~${f.lapsRemaining} laps`
  );
  lines.push('');

  // Tires (temp only)
  lines.push(
    `  Tires  LF ${formatTemp(tr.lf.temp)}  RF ${formatTemp(tr.rf.temp)}` +
    `   LR ${formatTemp(tr.lr.temp)}  RR ${formatTemp(tr.rr.temp)}`
  );
  lines.push('');

  // Track conditions
  lines.push(
    `  Track  ${formatTemp(tk.temperature)}  Air ${formatTemp(tk.airTemp)}` +
    `  Humidity ${tk.humidity.toFixed(0)}%  Wind ${tk.windSpeed.toFixed(1)}m/s`
  );

  // Pad to DASHBOARD_LINES
  while (lines.length < DASHBOARD_LINES) lines.push('');

  return lines;
}

// ─── Terminal output ──────────────────────────────────────────────────────────

/** Renderer owns cursor state so callers don't have to. */
export class DashboardRenderer {
  private rendered = false;
  private readonly stream: NodeJS.WriteStream;

  constructor(stream: NodeJS.WriteStream = process.stdout) {
    this.stream = stream;
  }

  render(state: DisplayState): void {
    const lines = buildDashboard(state);
    const output: string[] = [];

    if (this.rendered) {
      // Move cursor up to overwrite previous render
      output.push(ansi.cursorUp(DASHBOARD_LINES));
    }

    for (const line of lines) {
      output.push(`${ansi.clearLine}${ansi.cursorCol0}${line}`);
    }

    this.stream.write(output.join('\n') + '\n');
    this.rendered = true;
  }

  clear(): void {
    if (this.rendered) {
      const lines: string[] = [ansi.cursorUp(DASHBOARD_LINES)];
      for (let i = 0; i < DASHBOARD_LINES; i++) {
        lines.push(`${ansi.clearLine}`);
      }
      this.stream.write(lines.join('\n') + '\n');
    }
  }
}
