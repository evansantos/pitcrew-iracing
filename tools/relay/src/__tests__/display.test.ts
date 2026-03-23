import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatSpeed,
  formatRpm,
  formatFuel,
  formatTemp,
  formatLapTime,
  formatBandwidth,
  formatGear,
  bar,
  buildDashboard,
  DASHBOARD_LINES,
  DashboardRenderer,
} from '../display.js';
import type { DisplayState, TelemetryFrame } from '../types.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTelemetry(): TelemetryFrame {
  return {
    timestamp: Date.now(),
    sessionTime: 300,
    player: {
      speed: 180.5,
      rpm: 6200,
      gear: 5,
      throttle: 0.8,
      brake: 0,
      lap: 3,
      lapDistPct: 0.42,
      currentLapTime: 38.2,
      lastLapTime: 92.4,
      bestLapTime: 91.8,
      position: 2,
      classPosition: 1,
    },
    fuel: {
      level: 35,
      levelPct: 43.75,
      usePerHour: 3.2,
      lapsRemaining: 18,
    },
    tires: {
      lf: { temp: 88, wear: 0.1, pressure: 179 },
      rf: { temp: 90, wear: 0.12, pressure: 180 },
      lr: { temp: 85, wear: 0.08, pressure: 165 },
      rr: { temp: 87, wear: 0.09, pressure: 165 },
    },
    track: {
      temperature: 33,
      airTemp: 29,
      windSpeed: 3.1,
      windDirection: 0.8,
      humidity: 58,
    },
    session: {
      state: 4,
      flags: 0,
      timeRemaining: 3200,
      lapsRemaining: 27,
    },
  };
}

function makeState(overrides: Partial<DisplayState> = {}): DisplayState {
  return {
    connected: true,
    mockMode: false,
    clientCount: 2,
    bytesSent: 1500,
    frameCount: 120,
    track: 'Sebring International Raceway',
    car: 'Porsche 911 GT3 R',
    telemetry: makeTelemetry(),
    ...overrides,
  };
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

describe('formatSpeed', () => {
  it('formats km/h with one decimal', () => {
    expect(formatSpeed(180)).toContain('180.0');
    expect(formatSpeed(180)).toContain('km/h');
  });

  it('pads shorter values', () => {
    const result = formatSpeed(5);
    expect(result.indexOf('km/h')).toBeGreaterThan(0);
    // The numeric part should be right-padded to 6 chars
    expect(result.startsWith('   5.0')).toBe(true);
  });
});

describe('formatRpm', () => {
  it('rounds RPM to integer', () => {
    expect(formatRpm(6201.7)).toContain('6202');
    expect(formatRpm(6201.7)).toContain('RPM');
  });

  it('pads to 5 characters', () => {
    expect(formatRpm(500)).toMatch(/^\s*500 RPM/);
  });
});

describe('formatFuel', () => {
  it('formats fuel with one decimal and L suffix', () => {
    expect(formatFuel(35)).toContain('35.0');
    expect(formatFuel(35)).toContain('L');
  });
});

describe('formatTemp', () => {
  it('formats temperature without decimal', () => {
    expect(formatTemp(88.6)).toContain('89');
    expect(formatTemp(88.6)).toContain('°C');
  });
});

describe('formatLapTime', () => {
  it('returns dashes for zero or negative time', () => {
    expect(formatLapTime(0)).toBe('--:--.---');
    expect(formatLapTime(-1)).toBe('--:--.---');
  });

  it('formats minutes and seconds correctly', () => {
    // 1 min 32.456 seconds
    const result = formatLapTime(92.456);
    expect(result).toBe('1:32.456');
  });

  it('pads seconds below 10', () => {
    const result = formatLapTime(65.0);
    expect(result).toBe('1:05.000');
  });
});

describe('formatBandwidth', () => {
  it('shows bytes when < 1024', () => {
    expect(formatBandwidth(512)).toBe('512 B/s');
  });

  it('shows KB/s when < 1 MB', () => {
    expect(formatBandwidth(2048)).toContain('KB/s');
    expect(formatBandwidth(2048)).toContain('2.0');
  });

  it('shows MB/s for large values', () => {
    expect(formatBandwidth(2 * 1024 * 1024)).toContain('MB/s');
    expect(formatBandwidth(2 * 1024 * 1024)).toContain('2.00');
  });
});

describe('formatGear', () => {
  it('shows N for gear 0', () => {
    expect(formatGear(0)).toBe('N');
  });

  it('shows R for gear -1', () => {
    expect(formatGear(-1)).toBe('R');
  });

  it('shows numeric for other gears', () => {
    expect(formatGear(1)).toBe('1');
    expect(formatGear(6)).toBe('6');
  });
});

describe('bar', () => {
  it('returns all filled for value equal to max', () => {
    expect(bar(10, 10, 10)).toBe('██████████');
  });

  it('returns all empty for zero value', () => {
    expect(bar(0, 10, 10)).toBe('░░░░░░░░░░');
  });

  it('returns half filled for 50%', () => {
    expect(bar(5, 10, 10)).toBe('█████░░░░░');
  });

  it('clamps value above max', () => {
    expect(bar(20, 10, 10)).toBe('██████████');
  });

  it('uses default width of 10', () => {
    expect(bar(0, 10)).toHaveLength(10);
  });
});

// ─── buildDashboard ───────────────────────────────────────────────────────────

describe('buildDashboard', () => {
  it('returns exactly DASHBOARD_LINES lines', () => {
    const lines = buildDashboard(makeState());
    expect(lines).toHaveLength(DASHBOARD_LINES);
  });

  it('returns DASHBOARD_LINES lines even with no telemetry', () => {
    const lines = buildDashboard(makeState({ telemetry: null }));
    expect(lines).toHaveLength(DASHBOARD_LINES);
  });

  it('shows CONNECTED when connected', () => {
    const lines = buildDashboard(makeState({ connected: true }));
    expect(lines.some((l) => l.includes('CONNECTED'))).toBe(true);
  });

  it('shows DISCONNECTED when not connected', () => {
    const lines = buildDashboard(makeState({ connected: false }));
    expect(lines.some((l) => l.includes('DISCONNECTED'))).toBe(true);
  });

  it('shows MOCK label in mock mode', () => {
    const lines = buildDashboard(makeState({ mockMode: true }));
    expect(lines.some((l) => l.includes('MOCK'))).toBe(true);
  });

  it('does not show MOCK label in real mode', () => {
    const lines = buildDashboard(makeState({ mockMode: false }));
    expect(lines.some((l) => l.includes('MOCK'))).toBe(false);
  });

  it('shows client count', () => {
    const lines = buildDashboard(makeState({ clientCount: 5 }));
    expect(lines.some((l) => l.includes('5'))).toBe(true);
  });

  it('shows track name', () => {
    const lines = buildDashboard(makeState({ track: 'Spa-Francorchamps' }));
    expect(lines.some((l) => l.includes('Spa-Francorchamps'))).toBe(true);
  });

  it('shows car name', () => {
    const lines = buildDashboard(makeState({ car: 'Ferrari 296 GT3' }));
    expect(lines.some((l) => l.includes('Ferrari 296 GT3'))).toBe(true);
  });

  it('shows speed in km/h', () => {
    const lines = buildDashboard(makeState());
    // speed is 180.5 in fixture
    expect(lines.some((l) => l.includes('180.5'))).toBe(true);
  });

  it('shows lap number', () => {
    const lines = buildDashboard(makeState());
    // lap 3 in fixture
    expect(lines.some((l) => l.includes('Lap'))).toBe(true);
  });

  it('shows tire temperatures', () => {
    const lines = buildDashboard(makeState());
    // LF temp is 88
    expect(lines.some((l) => l.includes('88'))).toBe(true);
  });

  it('shows "No telemetry" message when telemetry is null', () => {
    const lines = buildDashboard(makeState({ telemetry: null }));
    expect(lines.some((l) => l.includes('No telemetry'))).toBe(true);
  });
});

// ─── DashboardRenderer ────────────────────────────────────────────────────────

describe('DashboardRenderer', () => {
  let writeSpy: ReturnType<typeof vi.fn>;
  let mockStream: NodeJS.WriteStream;
  let renderer: DashboardRenderer;

  beforeEach(() => {
    writeSpy = vi.fn().mockReturnValue(true);
    mockStream = {
      write: writeSpy,
    } as unknown as NodeJS.WriteStream;
    renderer = new DashboardRenderer(mockStream);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes to the stream on first render', () => {
    renderer.render(makeState());
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  it('writes to the stream on subsequent renders', () => {
    renderer.render(makeState());
    renderer.render(makeState());
    expect(writeSpy).toHaveBeenCalledTimes(2);
  });

  it('second render output contains cursor-up escape (for in-place update)', () => {
    renderer.render(makeState());
    renderer.render(makeState());

    const secondCall: string = writeSpy.mock.calls[1][0] as string;
    // ESC[<n>A is cursor up
    expect(secondCall).toMatch(/\x1b\[\d+A/);
  });

  it('first render does NOT contain cursor-up escape', () => {
    renderer.render(makeState());
    const firstCall: string = writeSpy.mock.calls[0][0] as string;
    expect(firstCall).not.toMatch(/\x1b\[\d+A/);
  });

  it('clear writes to the stream when previously rendered', () => {
    renderer.render(makeState());
    renderer.clear();
    expect(writeSpy).toHaveBeenCalledTimes(2);
  });

  it('clear does nothing before first render', () => {
    renderer.clear();
    expect(writeSpy).not.toHaveBeenCalled();
  });
});
