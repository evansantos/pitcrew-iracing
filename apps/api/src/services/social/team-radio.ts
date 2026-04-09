/**
 * Team Radio — multi-engineer messaging tied to telemetry session timestamps.
 * Supports up to 5 members per room (engineers + driver).
 */

import { randomUUID } from 'crypto';

export interface RadioMessage {
  id: string;
  sessionId: string;
  sender: string;       // engineer name or 'system'
  role: 'engineer' | 'driver' | 'system';
  message: string;
  timestamp: number;    // epoch ms
  sessionTime: number;  // telemetry session time when sent
  lap: number;
}

export interface TeamRadioRoom {
  sessionId: string;
  racerName: string;
  messages: RadioMessage[];
  members: Map<string, { name: string; role: 'engineer' | 'driver' }>;
}

const MAX_MEMBERS = 5;

export class TeamRadio {
  private rooms = new Map<string, TeamRadioRoom>();

  createRoom(sessionId: string, racerName: string): TeamRadioRoom {
    const room: TeamRadioRoom = {
      sessionId,
      racerName,
      messages: [],
      members: new Map(),
    };

    this.rooms.set(sessionId, room);
    return room;
  }

  getRoom(sessionId: string): TeamRadioRoom | null {
    return this.rooms.get(sessionId) ?? null;
  }

  addMember(
    sessionId: string,
    memberId: string,
    name: string,
    role: 'engineer' | 'driver'
  ): boolean {
    const room = this.rooms.get(sessionId);
    if (!room) return false;
    if (room.members.size >= MAX_MEMBERS) return false;

    room.members.set(memberId, { name, role });
    return true;
  }

  removeMember(sessionId: string, memberId: string): void {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    room.members.delete(memberId);
  }

  sendMessage(
    sessionId: string,
    sender: string,
    role: 'engineer' | 'driver' | 'system',
    message: string,
    sessionTime: number,
    lap: number
  ): RadioMessage {
    const room = this.rooms.get(sessionId);
    if (!room) {
      throw new Error(`No room found for session: ${sessionId}`);
    }

    const radioMessage: RadioMessage = {
      id: randomUUID(),
      sessionId,
      sender,
      role,
      message,
      timestamp: Date.now(),
      sessionTime,
      lap,
    };

    room.messages.push(radioMessage);
    return radioMessage;
  }

  getMessages(sessionId: string, afterTimestamp?: number): RadioMessage[] {
    const room = this.rooms.get(sessionId);
    if (!room) return [];

    if (afterTimestamp === undefined) {
      return [...room.messages];
    }

    return room.messages.filter(m => m.timestamp > afterTimestamp);
  }

  closeRoom(sessionId: string): void {
    this.rooms.delete(sessionId);
  }
}
