import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { AnnotationStore } from '../annotations.js';

let tmpDir: string;
let store: AnnotationStore;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'annotations-test-'));
  store = new AnnotationStore(tmpDir);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('AnnotationStore', () => {
  it('add creates annotation with correct fields', () => {
    const annotation = store.add('session-1', 'driver-A', 'marker', 'Turn 3 apex', 42.5, 1, 0.35, '#ff0000');

    expect(annotation.id).toBeDefined();
    expect(annotation.sessionId).toBe('session-1');
    expect(annotation.author).toBe('driver-A');
    expect(annotation.type).toBe('marker');
    expect(annotation.text).toBe('Turn 3 apex');
    expect(annotation.sessionTime).toBe(42.5);
    expect(annotation.lap).toBe(1);
    expect(annotation.lapDistPct).toBe(0.35);
    expect(annotation.color).toBe('#ff0000');
    expect(typeof annotation.createdAt).toBe('number');
  });

  it('add persists to disk', () => {
    store.add('session-1', 'driver-A', 'comment', 'Good exit', 60, 2, 0.5);

    const filePath = join(tmpDir, 'session-1', 'annotations.json');
    expect(existsSync(filePath)).toBe(true);

    const stored = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(stored).toHaveLength(1);
    expect(stored[0].text).toBe('Good exit');
  });

  it('getBySession returns all annotations', () => {
    store.add('session-1', 'driver-A', 'marker', 'First', 10, 1, 0.1);
    store.add('session-1', 'driver-B', 'comment', 'Second', 20, 2, 0.2);
    store.add('session-2', 'driver-A', 'highlight', 'Other session', 5, 1, 0.05);

    const result = store.getBySession('session-1');
    expect(result).toHaveLength(2);
    expect(result.map(a => a.text)).toEqual(expect.arrayContaining(['First', 'Second']));
  });

  it('getBySession loads from disk when not in memory', () => {
    // Add via one store instance (persists to disk)
    store.add('session-1', 'driver-A', 'marker', 'Persisted marker', 30, 1, 0.4);

    // New store instance — no in-memory cache
    const freshStore = new AnnotationStore(tmpDir);
    const result = freshStore.getBySession('session-1');

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Persisted marker');
  });

  it('getByLap filters correctly', () => {
    store.add('session-1', 'driver-A', 'marker', 'Lap 1 note', 10, 1, 0.1);
    store.add('session-1', 'driver-A', 'comment', 'Lap 2 note', 70, 2, 0.3);
    store.add('session-1', 'driver-A', 'highlight', 'Lap 2 other', 80, 2, 0.6);

    const lap2 = store.getByLap('session-1', 2);
    expect(lap2).toHaveLength(2);
    expect(lap2.every(a => a.lap === 2)).toBe(true);

    const lap1 = store.getByLap('session-1', 1);
    expect(lap1).toHaveLength(1);
  });

  it('delete removes annotation and returns true', () => {
    const a1 = store.add('session-1', 'driver-A', 'marker', 'To delete', 10, 1, 0.1);
    store.add('session-1', 'driver-B', 'comment', 'Keep this', 20, 1, 0.2);

    const result = store.delete('session-1', a1.id);
    expect(result).toBe(true);

    const remaining = store.getBySession('session-1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].text).toBe('Keep this');
  });

  it('delete returns false for unknown id', () => {
    store.add('session-1', 'driver-A', 'marker', 'Exists', 10, 1, 0.1);

    const result = store.delete('session-1', 'nonexistent-id');
    expect(result).toBe(false);
  });

  it('getBySession returns empty for unknown session', () => {
    const result = store.getBySession('no-such-session');
    expect(result).toEqual([]);
  });
});
