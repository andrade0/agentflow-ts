import { OpenAICompatProvider } from './base';
import type { ProviderConfig } from '../types';

export class GroqProvider extends OpenAICompatProvider {
  name = 'groq';

  constructor(config: ProviderConfig) {
    super({
      ...config,
      apiKey: config.apiKey || process.env.GROQ_API_KEY,
    });
  }

  protected getDefaultBaseUrl(): string {
    return 'https://api.groq.com/openai/v1';
  }
}
