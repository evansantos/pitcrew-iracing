/**
 * Discord Webhook Integration — send race alerts and session summaries via Discord webhooks.
 */

export interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string; // ISO 8601
}

export interface DiscordWebhookConfig {
  webhookUrl: string;
  enabled: boolean;
  racerName?: string; // filter alerts to specific racer
}

const COLORS = {
  red: 0xef4444,
  amber: 0xf59e0b,
  green: 0x22c55e,
  blue: 0x3b82f6,
} as const;

export class DiscordNotifier {
  private config: DiscordWebhookConfig;

  constructor(config: DiscordWebhookConfig) {
    this.config = config;
  }

  isEnabled(): boolean {
    return this.config.enabled && this.config.webhookUrl.length > 0;
  }

  async sendEmbed(embed: DiscordEmbed): Promise<boolean> {
    if (!this.isEnabled()) return false;

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });

      return response.status === 204;
    } catch {
      return false;
    }
  }

  buildPitAlert(racerName: string, lapsRemaining: number, optimalLap: number): DiscordEmbed {
    return {
      title: 'Pit Window Open',
      description: `**${racerName}** — pit window is now open.`,
      color: COLORS.amber,
      fields: [
        { name: 'Laps Remaining', value: String(lapsRemaining), inline: true },
        { name: 'Optimal Pit Lap', value: String(optimalLap), inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  buildFuelCritical(racerName: string, fuelLaps: number): DiscordEmbed {
    return {
      title: 'FUEL CRITICAL',
      description: `**${racerName}** — fuel critically low!`,
      color: COLORS.red,
      fields: [
        { name: 'Laps of Fuel Remaining', value: String(fuelLaps), inline: true },
      ],
      footer: { text: 'Box immediately' },
      timestamp: new Date().toISOString(),
    };
  }

  buildLapRecord(racerName: string, lapTime: number, lap: number): DiscordEmbed {
    return {
      title: 'New Best Lap',
      description: `**${racerName}** set a new personal best!`,
      color: COLORS.green,
      fields: [
        { name: 'Lap', value: String(lap), inline: true },
        { name: 'Lap Time', value: `${lapTime.toFixed(3)}s`, inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  buildSessionSummary(
    racerName: string,
    totalLaps: number,
    bestLap: number,
    avgLap: number,
    position: number
  ): DiscordEmbed {
    return {
      title: 'Session Summary',
      description: `Session complete for **${racerName}**.`,
      color: COLORS.blue,
      fields: [
        { name: 'Finish Position', value: `P${position}`, inline: true },
        { name: 'Total Laps', value: String(totalLaps), inline: true },
        { name: 'Best Lap', value: `${bestLap.toFixed(3)}s`, inline: true },
        { name: 'Average Lap', value: `${avgLap.toFixed(3)}s`, inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
  }
}
