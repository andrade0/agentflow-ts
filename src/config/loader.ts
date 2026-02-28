import { parse as parseYaml } from 'yaml';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { AgentFlowConfig, ProviderConfig, ProvidersConfig } from '../types';

const DEFAULT_CONFIG: AgentFlowConfig = {
  providers: {},
  defaults: {
    main: 'ollama/llama3.3:70b',
    subagent: 'ollama/llama3.3:70b',
    reviewer: 'ollama/llama3.3:70b',
  },
  skills: [],
};

export async function loadConfig(configPath?: string): Promise<AgentFlowConfig> {
  const paths = configPath
    ? [configPath]
    : [
        join(process.cwd(), '.agentflow', 'config.yaml'),
        join(process.cwd(), '.agentflow', 'config.yml'),
        join(process.cwd(), 'agentflow.yaml'),
        join(process.cwd(), 'agentflow.yml'),
        join(homedir(), '.agentflow', 'config.yaml'),
        join(homedir(), '.agentflow', 'config.yml'),
      ];

  for (const path of paths) {
    try {
      const content = await readFile(path, 'utf-8');
      const config = parseYaml(expandEnvVars(content)) as Partial<AgentFlowConfig>;
      return mergeConfig(DEFAULT_CONFIG, config);
    } catch {
      // Try next path
    }
  }

  return DEFAULT_CONFIG;
}

function expandEnvVars(content: string): string {
  return content.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] || '');
}

function normalizeProviderConfig(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    // Convert snake_case to camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

function mergeConfig(defaults: AgentFlowConfig, config: Partial<AgentFlowConfig>): AgentFlowConfig {
  // Normalize provider configs (snake_case to camelCase)
  const normalizedProviders: ProvidersConfig = {};
  if (config.providers) {
    for (const [name, providerConfig] of Object.entries(config.providers)) {
      if (providerConfig && typeof providerConfig === 'object') {
        normalizedProviders[name] = normalizeProviderConfig(providerConfig as Record<string, unknown>) as ProviderConfig;
      }
    }
  }

  return {
    providers: { ...defaults.providers, ...normalizedProviders },
    defaults: { ...defaults.defaults, ...config.defaults },
    skills: config.skills || defaults.skills,
  };
}

export async function saveConfig(config: AgentFlowConfig, path?: string): Promise<void> {
  const { stringify } = await import('yaml');
  const targetPath = path || join(process.cwd(), '.agentflow', 'config.yaml');
  
  // Ensure directory exists
  const dir = targetPath.substring(0, targetPath.lastIndexOf('/'));
  await Bun.write(targetPath, stringify(config));
  console.log(`Config saved to ${targetPath}`);
}

export function getDefaultConfig(): AgentFlowConfig {
  return { ...DEFAULT_CONFIG };
}
