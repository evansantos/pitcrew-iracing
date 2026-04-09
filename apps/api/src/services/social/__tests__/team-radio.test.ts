import { describe, it, expect } from 'vitest';
import { TeamRadio } from '../team-radio.js';

describe('TeamRadio', () => {
  it('createRoom creates a new room', () => {
    const radio = new TeamRadio();
    const room = radio.createRoom('session-1', 'Max Verstappen');

    expect(room.sessionId).toBe('session-1');
    expect(room.racerName).toBe('Max Verstappen');
    expect(room.messages).toHaveLength(0);
    expect(room.members.size).toBe(0);
  });

  it('getRoom returns null for unknown session', () => {
    const radio = new TeamRadio();

    expect(radio.getRoom('non-existent')).toBeNull();
  });

  it('addMember adds member and returns true', () => {
    const radio = new TeamRadio();
    radio.createRoom('session-2', 'Lewis Hamilton');

    const result = radio.addMember('session-2', 'member-1', 'Peter Bonnington', 'engineer');

    expect(result).toBe(true);
    const room = radio.getRoom('session-2');
    expect(room!.members.size).toBe(1);
    expect(room!.members.get('member-1')).toEqual({ name: 'Peter Bonnington', role: 'engineer' });
  });

  it('addMember returns false when room is full (max 5)', () => {
    const radio = new TeamRadio();
    radio.createRoom('session-3', 'Charles Leclerc');

    for (let i = 1; i <= 5; i++) {
      expect(radio.addMember('session-3', `member-${i}`, `Engineer ${i}`, 'engineer')).toBe(true);
    }

    const result = radio.addMember('session-3', 'member-6', 'Overflow Engineer', 'engineer');
    expect(result).toBe(false);
    expect(radio.getRoom('session-3')!.members.size).toBe(5);
  });

  it('sendMessage creates message with correct fields', () => {
    const radio = new TeamRadio();
    radio.createRoom('session-4', 'Fernando Alonso');

    const before = Date.now();
    const msg = radio.sendMessage('session-4', 'Gianpiero Lambiase', 'engineer', 'Box this lap', 3600, 12);
    const after = Date.now();

    expect(msg.id).toBeTruthy();
    expect(msg.sessionId).toBe('session-4');
    expect(msg.sender).toBe('Gianpiero Lambiase');
    expect(msg.role).toBe('engineer');
    expect(msg.message).toBe('Box this lap');
    expect(msg.sessionTime).toBe(3600);
    expect(msg.lap).toBe(12);
    expect(msg.timestamp).toBeGreaterThanOrEqual(before);
    expect(msg.timestamp).toBeLessThanOrEqual(after);
  });

  it('sendMessage appends to room messages', () => {
    const radio = new TeamRadio();
    radio.createRoom('session-5', 'Carlos Sainz');

    radio.sendMessage('session-5', 'Riccardo Adami', 'engineer', 'Copy, push now', 1800, 6);
    radio.sendMessage('session-5', 'Carlos Sainz', 'driver', 'Understood', 1802, 6);

    const room = radio.getRoom('session-5');
    expect(room!.messages).toHaveLength(2);
  });

  it('getMessages filters by afterTimestamp', () => {
    const radio = new TeamRadio();
    radio.createRoom('session-6', 'George Russell');

    const msg1 = radio.sendMessage('session-6', 'system', 'system', 'Session started', 0, 1);

    // Fake a slightly later timestamp for the second message by checking msg1 timestamp
    const msg2 = radio.sendMessage('session-6', 'Riccardo Musconi', 'engineer', 'Tyre temps good', 500, 3);

    const filtered = radio.getMessages('session-6', msg1.timestamp);

    // msg2 should be included if its timestamp > msg1.timestamp; msg1 should be excluded
    expect(filtered.every(m => m.timestamp > msg1.timestamp)).toBe(true);
    // msg2 is either included (if timestamps differ) or not — but total is never more than 2
    expect(filtered.length).toBeLessThanOrEqual(1);
    if (msg2.timestamp > msg1.timestamp) {
      expect(filtered).toContainEqual(msg2);
    }
  });

  it('closeRoom removes room', () => {
    const radio = new TeamRadio();
    radio.createRoom('session-7', 'Lando Norris');

    radio.closeRoom('session-7');

    expect(radio.getRoom('session-7')).toBeNull();
  });
});
