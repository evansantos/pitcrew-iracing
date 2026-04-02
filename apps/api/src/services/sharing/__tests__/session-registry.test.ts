import { describe, it, expect, vi, afterEach } from 'vitest';
import { SessionRegistry } from '../session-registry.js';

describe('SessionRegistry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a session with a 6-char code', () => {
    const registry = new SessionRegistry();
    const result = registry.createSession('Test Driver');

    expect(result.code).toHaveLength(6);
    expect(result.racerName).toBe('Test Driver');
  });

  it('looks up a session by code', () => {
    const registry = new SessionRegistry();
    const { code } = registry.createSession('Test Driver');

    const session = registry.getSession(code);
    expect(session).not.toBeNull();
    expect(session!.racerName).toBe('Test Driver');
  });

  it('returns null for unknown code', () => {
    const registry = new SessionRegistry();
    expect(registry.getSession('XXXXXX')).toBeNull();
  });

  it('tracks viewers', () => {
    const registry = new SessionRegistry();
    const { code } = registry.createSession('Test Driver');

    registry.addViewer(code, 'viewer-1');
    registry.addViewer(code, 'viewer-2');

    const session = registry.getSession(code);
    expect(session!.viewerCount).toBe(2);
  });

  it('enforces max viewer limit', () => {
    const registry = new SessionRegistry({ maxViewers: 2 });
    const { code } = registry.createSession('Test Driver');

    expect(registry.addViewer(code, 'v1')).toBe(true);
    expect(registry.addViewer(code, 'v2')).toBe(true);
    expect(registry.addViewer(code, 'v3')).toBe(false);
  });

  it('removes viewers', () => {
    const registry = new SessionRegistry();
    const { code } = registry.createSession('Test Driver');

    registry.addViewer(code, 'viewer-1');
    registry.removeViewer(code, 'viewer-1');

    const session = registry.getSession(code);
    expect(session!.viewerCount).toBe(0);
  });

  it('ends a session', () => {
    const registry = new SessionRegistry();
    const { code } = registry.createSession('Test Driver');

    registry.endSession(code);

    // Session still accessible until expiry
    const session = registry.getSession(code);
    expect(session).not.toBeNull();
    expect(session!.active).toBe(false);
  });

  it('generates unique codes', () => {
    const registry = new SessionRegistry();
    const codes = new Set<string>();

    for (let i = 0; i < 20; i++) {
      const { code } = registry.createSession(`Driver ${i}`);
      codes.add(code);
    }

    expect(codes.size).toBe(20);
  });
});
