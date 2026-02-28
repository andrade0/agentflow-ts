export { OpenAICompatProvider } from './base';
export { OllamaProvider } from './ollama';
export { GroqProvider } from './groq';
export { TogetherProvider } from './together';
export { OpenAIProvider } from './openai';
export { AnthropicProvider } from './anthropic';

import type { Provider, ProviderConfig, ProvidersConfig } from '../types';
import { OllamaProvider } from './ollama';
import { GroqProvider } from './groq';
import { TogetherProvider } from './together';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';

export function createProvider(name: string, config: ProviderConfig): Provider {
  switch (name) {
    case 'ollama':
      return new OllamaProvider(config);
    case 'groq':
      return new GroqProvider(config);
    case 'together':
      return new TogetherProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

export function createProviders(config: ProvidersConfig): Map<string, Provider> {
  const providers = new Map<string, Provider>();

  for (const [name, providerConfig] of Object.entries(config)) {
    if (providerConfig) {
      try {
        providers.set(name, createProvider(name, providerConfig));
      } catch (error) {
        console.warn(`Failed to create provider ${name}:`, error);
      }
    }
  }

  return providers;
}

export function parseModelString(modelString: string): { provider: string; model: string } {
  const parts = modelString.split('/');
  if (parts.length >= 2) {
    const provider = parts[0];
    const model = parts.slice(1).join('/');
    return { provider, model };
  }
  throw new Error(`Invalid model string: ${modelString}. Expected format: provider/model`);
}
