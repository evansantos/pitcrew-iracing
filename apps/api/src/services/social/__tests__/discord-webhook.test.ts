import { describe, it, expect, vi, afterEach } from 'vitest';
import { DiscordNotifier } from '../discord-webhook.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DiscordNotifier', () => {
  // 1. isEnabled returns false when disabled
  it('isEnabled returns false when disabled', () => {
    const notifier = new DiscordNotifier({
      webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      enabled: false,
    });

    expect(notifier.isEnabled()).toBe(false);
  });

  // 2. isEnabled returns true when enabled with valid URL
  it('isEnabled returns true when enabled with valid URL', () => {
    const notifier = new DiscordNotifier({
      webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      enabled: true,
    });

    expect(notifier.isEnabled()).toBe(true);
  });

  // 3. buildPitAlert returns correct embed structure
  it('buildPitAlert returns correct embed structure', () => {
    const notifier = new DiscordNotifier({
      webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      enabled: true,
    });

    const embed = notifier.buildPitAlert('Max Verstappen', 8, 12);

    expect(embed.title).toBe('Pit Window Open');
    expect(embed.color).toBe(0xf59e0b); // amber
    expect(embed.description).toContain('Max Verstappen');
    expect(embed.fields).toBeDefined();
    const lapsField = embed.fields!.find(f => f.name === 'Laps Remaining');
    const lapField = embed.fields!.find(f => f.name === 'Optimal Pit Lap');
    expect(lapsField?.value).toBe('8');
    expect(lapField?.value).toBe('12');
  });

  // 4. buildFuelCritical returns red embed with fuel data
  it('buildFuelCritical returns red embed with fuel data', () => {
    const notifier = new DiscordNotifier({
      webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      enabled: true,
    });

    const embed = notifier.buildFuelCritical('Lewis Hamilton', 2);

    expect(embed.title).toBe('FUEL CRITICAL');
    expect(embed.color).toBe(0xef4444); // red
    expect(embed.description).toContain('Lewis Hamilton');
    expect(embed.fields).toBeDefined();
    const fuelField = embed.fields!.find(f => f.name === 'Laps of Fuel Remaining');
    expect(fuelField?.value).toBe('2');
  });

  // 5. buildLapRecord returns green embed with lap time
  it('buildLapRecord returns green embed with lap time', () => {
    const notifier = new DiscordNotifier({
      webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      enabled: true,
    });

    const embed = notifier.buildLapRecord('Charles Leclerc', 85.432, 15);

    expect(embed.title).toBe('New Best Lap');
    expect(embed.color).toBe(0x22c55e); // green
    expect(embed.description).toContain('Charles Leclerc');
    expect(embed.fields).toBeDefined();
    const lapField = embed.fields!.find(f => f.name === 'Lap');
    const timeField = embed.fields!.find(f => f.name === 'Lap Time');
    expect(lapField?.value).toBe('15');
    expect(timeField?.value).toBe('85.432s');
  });

  // 6. buildSessionSummary includes all stat fields
  it('buildSessionSummary includes all stat fields', () => {
    const notifier = new DiscordNotifier({
      webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      enabled: true,
    });

    const embed = notifier.buildSessionSummary('Fernando Alonso', 30, 84.123, 86.456, 3);

    expect(embed.title).toBe('Session Summary');
    expect(embed.color).toBe(0x3b82f6); // blue
    expect(embed.description).toContain('Fernando Alonso');
    expect(embed.fields).toBeDefined();

    const fieldNames = embed.fields!.map(f => f.name);
    expect(fieldNames).toContain('Finish Position');
    expect(fieldNames).toContain('Total Laps');
    expect(fieldNames).toContain('Best Lap');
    expect(fieldNames).toContain('Average Lap');

    const posField = embed.fields!.find(f => f.name === 'Finish Position');
    const lapsField = embed.fields!.find(f => f.name === 'Total Laps');
    const bestField = embed.fields!.find(f => f.name === 'Best Lap');
    const avgField = embed.fields!.find(f => f.name === 'Average Lap');

    expect(posField?.value).toBe('P3');
    expect(lapsField?.value).toBe('30');
    expect(bestField?.value).toBe('84.123s');
    expect(avgField?.value).toBe('86.456s');
  });

  // 7. sendEmbed returns true on success (mock fetch returns 204)
  it('sendEmbed returns true on 204 response', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 204 })
    );

    const notifier = new DiscordNotifier({
      webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      enabled: true,
    });

    const embed = notifier.buildPitAlert('Lando Norris', 5, 10);
    const result = await notifier.sendEmbed(embed);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/123/abc',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"embeds"'),
      })
    );
  });

  // 8. sendEmbed returns false on network error (mock fetch throws)
  it('sendEmbed returns false on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network failure'));

    const notifier = new DiscordNotifier({
      webhookUrl: 'https://discord.com/api/webhooks/123/abc',
      enabled: true,
    });

    const embed = notifier.buildFuelCritical('George Russell', 1);
    const result = await notifier.sendEmbed(embed);

    expect(result).toBe(false);
  });
});
