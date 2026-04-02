/**
 * Metrics collector for relay server performance monitoring.
 * Tracks latency, throughput, frame rates, and client connections over time.
 */

export interface MetricsSnapshot {
  /** Connected client count */
  clientCount: number;
  /** Total bytes sent since start */
  totalBytesSent: number;
  /** Bytes sent in the last interval */
  bytesPerSecond: number;
  /** Total frames sent since start */
  totalFrames: number;
  /** Frames sent per second (recent window) */
  framesPerSecond: number;
  /** Latency stats from connected clients */
  latency: { min: number; avg: number; max: number };
  /** Server uptime in seconds */
  uptime: number;
}

export class MetricsCollector {
  private totalBytesSent = 0;
  private totalFrames = 0;
  private startTime = Date.now();

  // Rolling window for per-second calculations
  private recentBytes: { time: number; bytes: number }[] = [];
  private recentFrames: { time: number }[] = [];
  private readonly windowMs = 5000; // 5-second rolling window

  recordBytes(bytes: number): void {
    this.totalBytesSent += bytes;
    this.recentBytes.push({ time: Date.now(), bytes });
    this.pruneOld();
  }

  recordFrame(): void {
    this.totalFrames++;
    this.recentFrames.push({ time: Date.now() });
    this.pruneOld();
  }

  getSnapshot(clientCount: number, latency: { min: number; avg: number; max: number }): MetricsSnapshot {
    this.pruneOld();
    const windowSeconds = this.windowMs / 1000;

    const recentBytesTotal = this.recentBytes.reduce((sum, entry) => sum + entry.bytes, 0);

    return {
      clientCount,
      totalBytesSent: this.totalBytesSent,
      bytesPerSecond: Math.round(recentBytesTotal / windowSeconds),
      totalFrames: this.totalFrames,
      framesPerSecond: Math.round(this.recentFrames.length / windowSeconds),
      latency,
      uptime: Math.round((Date.now() - this.startTime) / 1000),
    };
  }

  private pruneOld(): void {
    const cutoff = Date.now() - this.windowMs;
    this.recentBytes = this.recentBytes.filter(e => e.time >= cutoff);
    this.recentFrames = this.recentFrames.filter(e => e.time >= cutoff);
  }
}
