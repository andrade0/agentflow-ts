import { describe, it, expect } from 'bun:test';
import { createProvider, parseModelString, createProviders } from '../src/providers';
import { OllamaProvider } from '../src/providers/ollama';
import { GroqProvider } from '../src/providers/groq';
import { TogetherProvider } from '../src/providers/together';

describe('parseModelString', () => {
  it('should parse provider/model format', () => {
    const result = parseModelString('ollama/llama3.3:70b');
    expect(result.provider).toBe('ollama');
    expect(result.model).toBe('llama3.3:70b');
  });

  it('should handle model names with slashes', () => {
    const result = parseModelString('together/meta-llama/Llama-3.3-70B');
    expect(result.provider).toBe('together');
    expect(result.model).toBe('meta-llama/Llama-3.3-70B');
  });

  it('should throw on invalid format', () => {
    expect(() => parseModelString('invalid')).toThrow();
  });
});

describe('createProvider', () => {
  it('should create OllamaProvider', () => {
    const provider = createProvider('ollama', { baseUrl: 'http://localhost:11434' });
    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.name).toBe('ollama');
  });

  it('should create GroqProvider', () => {
    const provider = createProvider('groq', { apiKey: 'test-key' });
    expect(provider).toBeInstanceOf(GroqProvider);
    expect(provider.name).toBe('groq');
  });

  it('should create TogetherProvider', () => {
    const provider = createProvider('together', { apiKey: 'test-key' });
    expect(provider).toBeInstanceOf(TogetherProvider);
    expect(provider.name).toBe('together');
  });

  it('should throw on unknown provider', () => {
    expect(() => createProvider('unknown', {})).toThrow();
  });
});

describe('createProviders', () => {
  it('should create multiple providers from config', () => {
    const providers = createProviders({
      ollama: { baseUrl: 'http://localhost:11434' },
      groq: { apiKey: 'test-key' },
    });

    expect(providers.size).toBe(2);
    expect(providers.has('ollama')).toBe(true);
    expect(providers.has('groq')).toBe(true);
  });

  it('should skip undefined providers', () => {
    const providers = createProviders({
      ollama: { baseUrl: 'http://localhost:11434' },
      groq: undefined,
    });

    expect(providers.size).toBe(1);
    expect(providers.has('ollama')).toBe(true);
    expect(providers.has('groq')).toBe(false);
  });
});
