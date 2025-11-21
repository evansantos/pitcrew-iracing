/**
 * Race Engineer LLM Service
 * Uses Ollama to provide AI-powered race engineering assistance
 */

import type { ProcessedTelemetry, StrategyRecommendation } from '@iracing-race-engineer/shared';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaRequest {
  model: string;
  messages: OllamaMessage[];
  stream: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
  };
}

interface OllamaResponse {
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

interface OllamaTagsResponse {
  models: Array<{
    name: string;
    modified_at: string;
    size: number;
  }>;
}

interface RaceEngineerContext {
  telemetry: ProcessedTelemetry;
  strategy?: StrategyRecommendation;
  lapNumber: number;
  sessionType: string;
}

export class RaceEngineerLLM {
  private baseUrl: string;
  private model: string;
  private conversationHistory: OllamaMessage[] = [];
  private systemPrompt: string;

  constructor(
    baseUrl: string = process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: string = process.env.OLLAMA_MODEL || 'llama3.1:8b'
  ) {
    this.baseUrl = baseUrl;
    this.model = model;
    this.systemPrompt = this.buildSystemPrompt();
    this.conversationHistory.push({
      role: 'system',
      content: this.systemPrompt,
    });
  }

  /**
   * Build the system prompt for the race engineer persona
   */
  private buildSystemPrompt(): string {
    return `You are an expert iRacing race engineer. Your job is to analyze telemetry data and provide concise, actionable race strategy advice.

ROLE:
- You are a professional race engineer working with a sim racer
- Analyze telemetry, fuel, tire, and strategy data
- Provide clear, brief recommendations (2-3 sentences max)
- Use racing terminology but keep it understandable
- Be direct and action-oriented

RESPONSE STYLE:
- Keep responses SHORT (2-3 sentences maximum)
- Start with the most critical information
- Use racing lingo: "Box this lap", "Push now", "Save fuel", "Manage tires"
- Include specific numbers when relevant (lap times, fuel levels, gaps)
- End with a clear action or status

EXAMPLES:
❌ BAD: "Well, looking at your telemetry data, I can see that you're currently using approximately 2.5 liters per lap..."
✅ GOOD: "Fuel critical. Box lap 23 for 15L. That gets you home with 2 lap margin."

❌ BAD: "The tire temperatures indicate that you might want to consider..."
✅ GOOD: "Tires at 85% health. Good for 12 more laps. Push hard now, pit window opens lap 18."

Remember: Race engineers communicate FAST, CLEAR, and ACTIONABLE. No fluff.`;
  }

  /**
   * Build context from telemetry and strategy data
   */
  private buildContext(context: RaceEngineerContext): string {
    const { telemetry, strategy, lapNumber } = context;

    // Build a concise data summary
    const contextParts = [
      `LAP ${lapNumber}/${telemetry.session.lapsRemaining + lapNumber}`,
      `POSITION: P${telemetry.player.position}`,
      `FUEL: ${telemetry.fuel.level.toFixed(1)}L`,
      `TIRES: ${(telemetry.tires.lf.avgWear * 100).toFixed(0)}% health`,
      `GAP TO LEADER: ${telemetry.player.position === 1 ? 'Leading' : 'In pursuit'}`,
    ];

    // Add strategy info if available
    if (strategy) {
      contextParts[2] += ` (${strategy.fuelStrategy.lapsUntilEmpty} laps)`;

      // Add critical strategy info
      if (!strategy.fuelStrategy.canFinish) {
        contextParts.push(`⚠️ FUEL: Need to pit - ${strategy.fuelStrategy.fuelToAdd.toFixed(1)}L required`);
      }

      if (strategy.tireStrategy.changeRecommended) {
        contextParts.push(`⚠️ TIRES: Change recommended - ${strategy.tireStrategy.degradationRate.toFixed(3)}% wear/lap`);
      }

      if (strategy.opportunities.length > 0) {
        contextParts.push(`OPPORTUNITIES: ${strategy.opportunities.length} detected`);
        strategy.opportunities.forEach((opp) => {
          contextParts.push(`  - ${opp.type}: ${opp.title}`);
        });
      }
    }

    return contextParts.join('\n');
  }

  /**
   * Get race advice based on current situation
   */
  async getAdvice(
    context: RaceEngineerContext,
    question?: string
  ): Promise<string> {
    try {
      // Build the context message
      const contextMessage = this.buildContext(context);

      // Build user message
      const userMessage = question
        ? `${contextMessage}\n\nQUESTION: ${question}`
        : `${contextMessage}\n\nProvide a brief situation update and any critical recommendations.`;

      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      // Keep conversation history limited (last 10 messages)
      if (this.conversationHistory.length > 11) {
        // Keep system prompt + last 10 messages
        this.conversationHistory = [
          this.conversationHistory[0],
          ...this.conversationHistory.slice(-10),
        ];
      }

      // Call Ollama API
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: this.conversationHistory,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_predict: 150, // Keep responses short
          },
        } as OllamaRequest),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json() as OllamaResponse;
      const assistantMessage = data.message.content;

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage,
      });

      return assistantMessage;
    } catch (error) {
      console.error('Race Engineer LLM error:', error);
      return 'Race engineer unavailable. Check Ollama connection.';
    }
  }

  /**
   * Get periodic automated updates (every N laps)
   */
  async getPeriodicUpdate(context: RaceEngineerContext): Promise<string | null> {
    const { lapNumber, strategy } = context;

    // Provide updates every 5 laps, or when critical
    const shouldUpdate =
      lapNumber % 5 === 0 ||
      (strategy && (
        !strategy.fuelStrategy.canFinish ||
        strategy.tireStrategy.changeRecommended ||
        strategy.opportunities.length > 0
      ));

    if (!shouldUpdate) {
      return null;
    }

    return this.getAdvice(context);
  }

  /**
   * Check if Ollama is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as OllamaTagsResponse;
      return data.models.map((m) => m.name);
    } catch {
      return [];
    }
  }

  /**
   * Reset conversation history
   */
  resetConversation(): void {
    this.conversationHistory = [
      {
        role: 'system',
        content: this.systemPrompt,
      },
    ];
  }
}
