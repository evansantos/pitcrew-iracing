/**
 * Playback engine for session replay.
 * Manages cursor position, play/pause/seek/speed controls.
 * Emits telemetry frames at the correct timing.
 */
import type { StoredFrame } from '@iracing-race-engineer/shared';

export interface PlaybackState {
  cursor: number;
  totalFrames: number;
  playing: boolean;
  speed: number;
  sessionTime: number;
}

export class PlaybackEngine {
  private frames: StoredFrame[];
  private cursor = 0;
  private playing = false;
  private speed = 1;
  private playTimer: ReturnType<typeof setInterval> | null = null;
  private onFrame?: (frame: StoredFrame) => void;

  constructor(frames: StoredFrame[], onFrame?: (frame: StoredFrame) => void) {
    this.frames = frames;
    this.onFrame = onFrame;
  }

  getState(): PlaybackState {
    return {
      cursor: this.cursor,
      totalFrames: this.frames.length,
      playing: this.playing,
      speed: this.speed,
      sessionTime: this.frames[this.cursor]?.telemetry.sessionTime ?? 0,
    };
  }

  getCurrentFrame(): StoredFrame | null {
    return this.frames[this.cursor] ?? null;
  }

  play(): void {
    if (this.playing || this.frames.length === 0) return;
    this.playing = true;
    this.startTimer();
  }

  pause(): void {
    this.playing = false;
    this.stopTimer();
  }

  seek(frame: number): void {
    this.cursor = Math.max(0, Math.min(frame, this.frames.length - 1));
    const current = this.getCurrentFrame();
    if (current && this.onFrame) {
      this.onFrame(current);
    }
  }

  seekToLap(lap: number): void {
    const idx = this.frames.findIndex(f => f.lap === lap);
    if (idx >= 0) {
      this.seek(idx);
    }
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.25, Math.min(4, speed));
    if (this.playing) {
      this.stopTimer();
      this.startTimer();
    }
  }

  step(): void {
    if (this.cursor >= this.frames.length - 1) {
      this.playing = false;
      this.stopTimer();
      return;
    }
    this.cursor++;
    const frame = this.getCurrentFrame();
    if (frame && this.onFrame) {
      this.onFrame(frame);
    }
  }

  close(): void {
    this.stopTimer();
    this.playing = false;
  }

  private startTimer(): void {
    this.stopTimer();

    // Calculate interval based on actual telemetry timing and speed
    const baseIntervalMs = this.frames.length >= 2
      ? Math.abs(this.frames[1].telemetry.sessionTime - this.frames[0].telemetry.sessionTime) * 1000
      : 16; // ~60fps default

    const interval = Math.max(1, baseIntervalMs / this.speed);

    this.playTimer = setInterval(() => {
      this.step();
    }, interval);
  }

  private stopTimer(): void {
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }
  }
}
