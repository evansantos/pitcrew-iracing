/**
 * Session Registry — manages live telemetry sharing sessions.
 * Generates 6-char human-readable codes, tracks viewers, handles expiry.
 */

export interface SharedSession {
  code: string;
  racerName: string;
  createdAt: number;
  active: boolean;
  viewers: Set<string>;
  viewerCount: number;
  expiryTimer?: ReturnType<typeof setTimeout>;
}

export interface SessionRegistryOptions {
  /** Max viewers per session (default 10) */
  maxViewers?: number;
  /** Expiry time after driver disconnects in ms (default 300000 = 5 min) */
  expiryMs?: number;
}

// Human-readable character set (no ambiguous chars like 0/O, 1/I/l)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class SessionRegistry {
  private sessions = new Map<string, SharedSession>();
  private readonly maxViewers: number;
  private readonly expiryMs: number;

  constructor(options: SessionRegistryOptions = {}) {
    this.maxViewers = options.maxViewers ?? 10;
    this.expiryMs = options.expiryMs ?? 300_000;
  }

  createSession(racerName: string): { code: string; racerName: string } {
    const code = this.generateCode();

    const session: SharedSession = {
      code,
      racerName,
      createdAt: Date.now(),
      active: true,
      viewers: new Set(),
      viewerCount: 0,
    };

    this.sessions.set(code, session);

    return { code, racerName };
  }

  getSession(code: string): SharedSession | null {
    return this.sessions.get(code) ?? null;
  }

  addViewer(code: string, viewerId: string): boolean {
    const session = this.sessions.get(code);
    if (!session) return false;
    if (session.viewers.size >= this.maxViewers) return false;

    session.viewers.add(viewerId);
    session.viewerCount = session.viewers.size;
    return true;
  }

  removeViewer(code: string, viewerId: string): void {
    const session = this.sessions.get(code);
    if (!session) return;

    session.viewers.delete(viewerId);
    session.viewerCount = session.viewers.size;
  }

  endSession(code: string): void {
    const session = this.sessions.get(code);
    if (!session) return;

    session.active = false;

    // Schedule cleanup after expiry
    session.expiryTimer = setTimeout(() => {
      this.sessions.delete(code);
    }, this.expiryMs);
  }

  listActiveSessions(): SharedSession[] {
    return Array.from(this.sessions.values()).filter(s => s.active);
  }

  private generateCode(): string {
    let code: string;
    do {
      code = Array.from(
        { length: 6 },
        () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
      ).join('');
    } while (this.sessions.has(code));

    return code;
  }
}
