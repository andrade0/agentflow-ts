import type { Message, ChatOptions, Provider, ProviderConfig } from '../types';

export class OllamaProvider implements Provider {
  name = 'ollama';
  private baseUrl: string;
  private models: string[];

  constructor(config: ProviderConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.models = config.models || [];
  }

  async *chat(messages: Message[], options: ChatOptions = {}): AsyncGenerator<string, void, unknown> {
    const model = options.model || this.models[0];
    if (!model) {
      throw new Error('No model specified for Ollama provider');
    }

    const body = {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 4096,
        stop: options.stop,
      },
    };

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
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
        if (!line.trim()) continue;

        try {
          const json = JSON.parse(line) as { message?: { content: string }; done?: boolean };
          if (json.message?.content) {
            yield json.message.content;
          }
          if (json.done) {
            return;
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
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        return [];
      }

      const data = await response.json() as { models?: Array<{ name: string }> };
      return data.models?.map((m) => m.name) || [];
    } catch {
      return [];
    }
  }
}
