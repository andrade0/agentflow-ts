// Core types for AgentFlow

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  stop?: string[];
}

export interface Provider {
  name: string;
  chat(messages: Message[], options?: ChatOptions): AsyncGenerator<string, void, unknown>;
  listModels(): Promise<string[]>;
}

export interface ProviderConfig {
  baseUrl?: string;
  apiKey?: string;
  models?: string[];
}

export interface ProvidersConfig {
  ollama?: ProviderConfig;
  groq?: ProviderConfig;
  together?: ProviderConfig;
  anthropic?: ProviderConfig;
  openai?: ProviderConfig;
  [key: string]: ProviderConfig | undefined;
}

export interface DefaultsConfig {
  main?: string;
  subagent?: string;
  reviewer?: string;
}

export interface AgentFlowConfig {
  providers: ProvidersConfig;
  defaults?: DefaultsConfig;
  skills?: string[];
}

export interface Skill {
  name: string;
  description: string;
  trigger?: string;
  template: string;
  frontmatter: Record<string, unknown>;
}

export interface AgentContext {
  messages: Message[];
  taskProgress: number;
  lastMessage?: string;
  skills: Skill[];
  config: AgentFlowConfig;
}

export interface ContinueDecision {
  continue: boolean;
  reason: string;
}

export interface SubagentTask {
  id: string;
  prompt: string;
  model?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
}
