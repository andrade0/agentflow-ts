import { OpenAICompatProvider } from './base';
import type { ProviderConfig } from '../types';

export class TogetherProvider extends OpenAICompatProvider {
  name = 'together';

  constructor(config: ProviderConfig) {
    super({
      ...config,
      apiKey: config.apiKey || process.env.TOGETHER_API_KEY,
    });
  }

  protected getDefaultBaseUrl(): string {
    return 'https://api.together.xyz/v1';
  }
}
