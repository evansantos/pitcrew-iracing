/**
 * AIProvider interface — abstraction over LLM backends.
 * Supports Ollama (local), Claude (Anthropic), and OpenAI.
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface AICompletionResult {
  content: string;
  tokensUsed: number;
}

export interface AIProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult>;
}

// ─── Ollama Provider ────────────────────────────────────────────────────────

export class OllamaProvider implements AIProvider {
  readonly name = 'ollama';
  private baseUrl: string;
  private model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = model || process.env.OLLAMA_MODEL || 'llama3.1:8b';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 150,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '(unreadable)');
      throw new Error(`Ollama API error (${response.status}): ${body}`);
    }

    const data = await response.json() as {
      message: { content: string };
      eval_count?: number;
      prompt_eval_count?: number;
    };

    return {
      content: data.message.content,
      tokensUsed: (data.eval_count || 0) + (data.prompt_eval_count || 0),
    };
  }
}

// ─── Claude Provider ────────────────────────────────────────────────────────

export class ClaudeProvider implements AIProvider {
  readonly name = 'claude';
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.model = model || process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  async complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult> {
    // Extract system message
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystemMsgs = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens ?? 150,
        system: systemMsg?.content,
        messages: nonSystemMsgs.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '(unreadable)');
      throw new Error(`Claude API error (${response.status}): ${body}`);
    }

    const data = await response.json() as {
      content: Array<{ text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    return {
      content: data.content[0]?.text || '',
      tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    };
  }
}

// ─── OpenAI Provider ────────────────────────────────────────────────────────

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.model = model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  async complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: options?.maxTokens ?? 150,
        temperature: options?.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '(unreadable)');
      throw new Error(`OpenAI API error (${response.status}): ${body}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content || '',
      tokensUsed: data.usage?.total_tokens || 0,
    };
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createAIProvider(provider?: string): AIProvider {
  const name = provider || process.env.AI_PROVIDER || 'ollama';
  switch (name) {
    case 'claude':
      return new ClaudeProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'ollama':
      return new OllamaProvider();
    default:
      console.warn(`[AI] Unknown provider "${name}", falling back to ollama`);
      return new OllamaProvider();
  }
}
