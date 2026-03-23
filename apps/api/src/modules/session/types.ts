export interface SessionInfo {
  sessionDbId: number | null;
  sessionId: string | null;
}

export interface SessionResponse {
  session: SessionInfo;
  isActive: boolean;
  timestamp: string;
}

export interface CleanupRequest {
  days?: number;
}

export interface CleanupResult {
  success: boolean;
  sessionsDeleted: number;
  lapsDeleted: number;
  snapshotsDeleted: number;
  message: string;
}
