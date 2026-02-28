import type { Message, ChatOptions, Provider, ProviderConfig } from '../types';

export abstract class OpenAICompatProvider implements Provider {
  abstract name: string;
  protected baseUrl: string;
  protected apiKey?: string;
  protected models: string[];

  constructor(config: ProviderConfig) {
    this.baseUrl = config.baseUrl || this.getDefaultBaseUrl();
    this.apiKey = config.apiKey;
    this.models = config.models || [];
  }

  protected abstract getDefaultBaseUrl(): string;

  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async *chat(messages: Message[], options: ChatOptions = {}): AsyncGenerator<string, void, unknown> {
    const model = options.model || this.models[0];
    if (!model) {
      throw new Error(`No model specified for ${this.name} provider`);
    }

    const body = {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
      stop: options.stop,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.name} API error: ${response.status} - ${error}`);
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
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  async listModels(): Promise<string[]> {
    if (this.models.length > 0) {
      return this.models;
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as { data?: Array<{ id: string }> };
      return data.data?.map((m) => m.id) || [];
    } catch {
      return [];
    }
  }
}
