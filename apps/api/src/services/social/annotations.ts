/**
 * Annotations — markers and comments placed on session replays at specific timestamps.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

export interface Annotation {
  id: string;
  sessionId: string;
  author: string;
  type: 'marker' | 'comment' | 'highlight';
  text: string;
  sessionTime: number;  // session time in seconds where annotation is placed
  lap: number;
  lapDistPct: number;   // track position 0-1
  color?: string;       // optional color for markers
  createdAt: number;    // epoch ms
}

export class AnnotationStore {
  private readonly dataDir: string;
  private cache = new Map<string, Annotation[]>();

  constructor(dataDir: string) {
    this.dataDir = dataDir;

    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  add(
    sessionId: string,
    author: string,
    type: Annotation['type'],
    text: string,
    sessionTime: number,
    lap: number,
    lapDistPct: number,
    color?: string,
  ): Annotation {
    const annotation: Annotation = {
      id: randomUUID(),
      sessionId,
      author,
      type,
      text,
      sessionTime,
      lap,
      lapDistPct,
      ...(color !== undefined ? { color } : {}),
      createdAt: Date.now(),
    };

    const existing = this.loadIntoCache(sessionId);
    existing.push(annotation);

    this.persist(sessionId);

    return annotation;
  }

  getBySession(sessionId: string): Annotation[] {
    return this.loadIntoCache(sessionId);
  }

  getByLap(sessionId: string, lap: number): Annotation[] {
    return this.loadIntoCache(sessionId).filter(a => a.lap === lap);
  }

  delete(sessionId: string, annotationId: string): boolean {
    const annotations = this.loadIntoCache(sessionId);
    const index = annotations.findIndex(a => a.id === annotationId);

    if (index === -1) return false;

    annotations.splice(index, 1);
    this.persist(sessionId);

    return true;
  }

  persist(sessionId: string): void {
    const sessionDir = join(this.dataDir, sessionId);
    if (!existsSync(sessionDir)) {
      mkdirSync(sessionDir, { recursive: true });
    }

    const filePath = join(sessionDir, 'annotations.json');
    const annotations = this.cache.get(sessionId) ?? [];
    writeFileSync(filePath, JSON.stringify(annotations, null, 2));
  }

  // --- Private helpers ---

  private loadIntoCache(sessionId: string): Annotation[] {
    if (this.cache.has(sessionId)) {
      return this.cache.get(sessionId)!;
    }

    const filePath = join(this.dataDir, sessionId, 'annotations.json');
    if (existsSync(filePath)) {
      try {
        const data = JSON.parse(readFileSync(filePath, 'utf-8')) as Annotation[];
        this.cache.set(sessionId, data);
        return data;
      } catch {
        // Fall through to empty
      }
    }

    const empty: Annotation[] = [];
    this.cache.set(sessionId, empty);
    return empty;
  }
}
