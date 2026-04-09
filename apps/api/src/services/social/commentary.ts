/**
 * Commentary Engine — auto-generates text commentary from race events.
 * Detects overtakes, position losses, lap records, flag changes, and more.
 */

import { randomUUID } from 'crypto';

export type EventType =
  | 'overtake'
  | 'position_lost'
  | 'pit_entry'
  | 'pit_exit'
  | 'flag'
  | 'lap_record'
  | 'incident'
  | 'session_start'
  | 'session_end';

export interface CommentaryEvent {
  id: string;
  type: EventType;
  message: string;
  timestamp: number;     // epoch ms
  sessionTime: number;
  lap: number;
  racerName: string;
  metadata?: Record<string, unknown>;
}

export interface TelemetrySnapshot {
  player: {
    position: number;
    lap: number;
    lastLapTime: number;
  };
  session: {
    flags: string;
  };
}

const MAX_EVENTS = 200;

function formatLapTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(3);
  return `${minutes}:${seconds.padStart(6, '0')}`;
}

export class CommentaryEngine {
  private events: CommentaryEvent[] = [];
  private lastPositions = new Map<string, number>();
  private lastLapTimes = new Map<string, number>();
  private lastFlags = new Map<string, string>();
  private bestLapTime = Infinity;

  processTelemetry(
    racerName: string,
    telemetry: TelemetrySnapshot,
    sessionTime: number,
    lap: number
  ): CommentaryEvent[] {
    const newEvents: CommentaryEvent[] = [];

    const { position, lastLapTime } = telemetry.player;
    const { flags } = telemetry.session;

    // --- Position change detection ---
    const prevPosition = this.lastPositions.get(racerName);
    if (prevPosition !== undefined && prevPosition !== position) {
      if (position < prevPosition) {
        // Gained position(s)
        const event = this.buildEvent(
          'overtake',
          `${racerName} gained a position! Now P${position}`,
          racerName,
          sessionTime,
          lap
        );
        newEvents.push(event);
      } else {
        // Lost position(s)
        const event = this.buildEvent(
          'position_lost',
          `${racerName} dropped to P${position}`,
          racerName,
          sessionTime,
          lap
        );
        newEvents.push(event);
      }
    }
    this.lastPositions.set(racerName, position);

    // --- Lap record detection ---
    if (lastLapTime > 0) {
      const prevBest = this.lastLapTimes.get(racerName) ?? Infinity;
      if (lastLapTime < this.bestLapTime) {
        this.bestLapTime = lastLapTime;
        this.lastLapTimes.set(racerName, lastLapTime);
        const event = this.buildEvent(
          'lap_record',
          `NEW BEST LAP: ${formatLapTime(lastLapTime)} by ${racerName}!`,
          racerName,
          sessionTime,
          lap,
          { lapTime: lastLapTime, previousBest: prevBest === Infinity ? null : prevBest }
        );
        newEvents.push(event);
      } else if (lastLapTime < prevBest) {
        this.lastLapTimes.set(racerName, lastLapTime);
      }
    }

    // --- Flag change detection ---
    const prevFlags = this.lastFlags.get(racerName);
    if (prevFlags !== undefined && prevFlags !== flags) {
      const flagMessage = this.buildFlagMessage(flags);
      if (flagMessage) {
        const event = this.buildEvent(
          'flag',
          flagMessage,
          racerName,
          sessionTime,
          lap,
          { flag: flags, previousFlag: prevFlags }
        );
        newEvents.push(event);
      }
    }
    this.lastFlags.set(racerName, flags);

    // Push all new events into buffer
    for (const event of newEvents) {
      this.addToBuffer(event);
    }

    return newEvents;
  }

  getEvents(limit?: number, afterTimestamp?: number): CommentaryEvent[] {
    let result = [...this.events];

    if (afterTimestamp !== undefined) {
      result = result.filter(e => e.timestamp > afterTimestamp);
    }

    if (limit !== undefined && limit > 0) {
      result = result.slice(-limit);
    }

    return result;
  }

  addCustomEvent(
    type: EventType,
    message: string,
    racerName: string,
    sessionTime: number,
    lap: number,
    metadata?: Record<string, unknown>
  ): CommentaryEvent {
    const event = this.buildEvent(type, message, racerName, sessionTime, lap, metadata);
    this.addToBuffer(event);
    return event;
  }

  private buildEvent(
    type: EventType,
    message: string,
    racerName: string,
    sessionTime: number,
    lap: number,
    metadata?: Record<string, unknown>
  ): CommentaryEvent {
    return {
      id: randomUUID(),
      type,
      message,
      timestamp: Date.now(),
      sessionTime,
      lap,
      racerName,
      ...(metadata ? { metadata } : {}),
    };
  }

  private addToBuffer(event: CommentaryEvent): void {
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
    }
  }

  private buildFlagMessage(flags: string): string | null {
    const upper = flags.toUpperCase();
    if (upper.includes('YELLOW')) return 'YELLOW FLAG';
    if (upper.includes('GREEN')) return 'GREEN FLAG';
    if (upper.includes('RED')) return 'RED FLAG';
    if (upper.includes('CHECKERED') || upper.includes('CHEQUERED')) return 'CHECKERED FLAG — Race Over!';
    if (upper.includes('WHITE')) return 'WHITE FLAG — Final Lap!';
    if (upper.includes('BLACK')) return 'BLACK FLAG';
    return null;
  }
}
