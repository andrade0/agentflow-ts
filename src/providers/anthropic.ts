import type { Message, ChatOptions, Provider, ProviderConfig } from '../types';

export class AnthropicProvider implements Provider {
  name = 'anthropic';
  private baseUrl: string;
  private apiKey?: string;
  private models: string[];

  constructor(config: ProviderConfig) {
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    this.models = config.models || ['claude-sonnet-4-20250514'];
  }

  async *chat(messages: Message[], options: ChatOptions = {}): AsyncGenerator<string, void, unknown> {
    const model = options.model || this.models[0];
    if (!model) {
      throw new Error('No model specified for Anthropic provider');
    }

    if (!this.apiKey) {
      throw new Error('Anthropic API key required');
    }

    // Extract system message
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
      messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
    };

    if (systemMessage) {
      body.system = systemMessage.content;
    }

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          if (json.type === 'content_block_delta' && json.delta?.text) {
            yield json.delta.text;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  async listModels(): Promise<string[]> {
    return this.models;
  }
}
