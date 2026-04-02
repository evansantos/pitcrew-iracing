import { describe, it, expect } from 'vitest';
import { MetricsCollector } from '../metrics.js';

describe('MetricsCollector', () => {
  it('starts with zero totals', () => {
    const collector = new MetricsCollector();
    const snapshot = collector.getSnapshot(0, { min: 0, avg: 0, max: 0 });

    expect(snapshot.totalBytesSent).toBe(0);
    expect(snapshot.totalFrames).toBe(0);
    expect(snapshot.clientCount).toBe(0);
  });

  it('accumulates total bytes sent', () => {
    const collector = new MetricsCollector();
    collector.recordBytes(1000);
    collector.recordBytes(2000);

    const snapshot = collector.getSnapshot(2, { min: 5, avg: 10, max: 15 });
    expect(snapshot.totalBytesSent).toBe(3000);
  });

  it('accumulates total frames', () => {
    const collector = new MetricsCollector();
    collector.recordFrame();
    collector.recordFrame();
    collector.recordFrame();

    const snapshot = collector.getSnapshot(1, { min: 0, avg: 0, max: 0 });
    expect(snapshot.totalFrames).toBe(3);
  });

  it('passes through client count and latency', () => {
    const collector = new MetricsCollector();
    const latency = { min: 2, avg: 8, max: 15 };

    const snapshot = collector.getSnapshot(5, latency);
    expect(snapshot.clientCount).toBe(5);
    expect(snapshot.latency).toEqual(latency);
  });

  it('calculates positive bytes per second for recent data', () => {
    const collector = new MetricsCollector();
    collector.recordBytes(5000);
    collector.recordBytes(5000);

    const snapshot = collector.getSnapshot(1, { min: 0, avg: 0, max: 0 });
    expect(snapshot.bytesPerSecond).toBeGreaterThan(0);
  });

  it('calculates positive frames per second for recent data', () => {
    const collector = new MetricsCollector();
    for (let i = 0; i < 10; i++) {
      collector.recordFrame();
    }

    const snapshot = collector.getSnapshot(1, { min: 0, avg: 0, max: 0 });
    expect(snapshot.framesPerSecond).toBeGreaterThan(0);
  });

  it('tracks uptime', () => {
    const collector = new MetricsCollector();
    const snapshot = collector.getSnapshot(0, { min: 0, avg: 0, max: 0 });
    expect(snapshot.uptime).toBeGreaterThanOrEqual(0);
  });
});
