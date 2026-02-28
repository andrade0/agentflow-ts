import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { loadConfig, getDefaultConfig } from '../src/config/loader';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';

const TEST_DIR = join(import.meta.dir, 'test-config');

beforeAll(async () => {
  await mkdir(TEST_DIR, { recursive: true });
  
  await writeFile(join(TEST_DIR, 'config.yaml'), `
providers:
  ollama:
    base_url: http://localhost:11434
    models:
      - llama3.3:70b
  groq:
    api_key: test-key
    models:
      - llama-3.3-70b-versatile

defaults:
  main: groq/llama-3.3-70b-versatile
  subagent: ollama/llama3.3:70b
`);
});

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('getDefaultConfig', () => {
  it('should return default config', () => {
    const config = getDefaultConfig();
    
    expect(config.providers).toEqual({});
    expect(config.defaults).toBeDefined();
    expect(config.defaults?.main).toBeDefined();
  });
});

describe('loadConfig', () => {
  it('should load config from file', async () => {
    const config = await loadConfig(join(TEST_DIR, 'config.yaml'));
    
    expect(config.providers.ollama).toBeDefined();
    expect(config.providers.ollama?.baseUrl).toBe('http://localhost:11434');
    expect(config.providers.groq?.apiKey).toBe('test-key');
    expect(config.defaults?.main).toBe('groq/llama-3.3-70b-versatile');
  });

  it('should return default config for non-existent file', async () => {
    const config = await loadConfig('/nonexistent/config.yaml');
    
    expect(config).toEqual(getDefaultConfig());
  });
});
