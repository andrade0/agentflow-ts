import { OpenAICompatProvider } from './base';
import type { ProviderConfig } from '../types';

export class OpenAIProvider extends OpenAICompatProvider {
  name = 'openai';

  constructor(config: ProviderConfig) {
    super({
      ...config,
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
    });
  }

  protected getDefaultBaseUrl(): string {
    return 'https://api.openai.com/v1';
  }
}
