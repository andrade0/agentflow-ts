/**
 * Token Counter - Count tokens for LLM context tracking
 * Uses tiktoken-compatible encoding or fast approximation
 */

import type { Message } from '../types';

// Token estimation constants per model family
const CHARS_PER_TOKEN: Record<string, number> = {
  // GPT-4, Claude use ~4 chars per token for English
  'gpt-4': 4,
  'gpt-3.5': 4,
  'claude': 4,
  'anthropic': 4,
  // Llama models are similar
  'llama': 4,
  'mistral': 4,
  'mixtral': 4,
  // Default fallback
  'default': 4,
};

// Context window sizes per model
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // GPT models
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-3.5-turbo': 16385,
  // Claude models
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-3.5-sonnet': 200000,
  // Llama models
  'llama3.3:70b': 131072,
  'llama3.3': 131072,
  'llama3.2': 128000,
  'llama3.1': 128000,
  'llama3': 8192,
  'llama2': 4096,
  'codellama': 16384,
  // Mistral models
  'mistral': 32768,
  'mixtral': 32768,
  'mistral-large': 128000,
  // Groq models
  'llama-3.3-70b-versatile': 131072,
  'llama-3.1-70b-versatile': 131072,
  'mixtral-8x7b-32768': 32768,
  // Default
  'default': 8192,
};

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface SessionTokens {
  totalInput: number;
  totalOutput: number;
  total: number;
  messageBreakdown: MessageTokens[];
}

export interface MessageTokens {
  role: string;
  content: string;
  tokens: number;
  timestamp: Date;
}

/**
 * Estimate tokens for a string using character-based approximation
 */
export function estimateTokens(text: string, model = 'default'): number {
  if (!text) return 0;
  
  // Find matching model family
  const modelLower = model.toLowerCase();
  let charsPerToken = CHARS_PER_TOKEN.default;
  
  for (const [family, ratio] of Object.entries(CHARS_PER_TOKEN)) {
    if (modelLower.includes(family)) {
      charsPerToken = ratio;
      break;
    }
  }
  
  // Estimate based on characters
  // Add overhead for special tokens, punctuation handling
  const baseTokens = Math.ceil(text.length / charsPerToken);
  const overhead = Math.ceil(baseTokens * 0.1); // 10% overhead
  
  return baseTokens + overhead;
}

/**
 * Estimate tokens for a message (includes role overhead)
 */
export function estimateMessageTokens(message: Message, model = 'default'): number {
  // Role token overhead: system ~4, user ~4, assistant ~4
  const roleOverhead = 4;
  return estimateTokens(message.content, model) + roleOverhead;
}

/**
 * Estimate total tokens for a conversation
 */
export function estimateConversationTokens(messages: Message[], model = 'default'): number {
  let total = 0;
  
  for (const msg of messages) {
    total += estimateMessageTokens(msg, model);
  }
  
  // Add conversation overhead (start/end tokens)
  total += 3;
  
  return total;
}

/**
 * Get context limit for a model
 */
export function getContextLimit(model: string): number {
  const modelLower = model.toLowerCase();
  
  // Direct match
  if (MODEL_CONTEXT_LIMITS[modelLower]) {
    return MODEL_CONTEXT_LIMITS[modelLower];
  }
  
  // Partial match
  for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (modelLower.includes(key) || key.includes(modelLower)) {
      return limit;
    }
  }
  
  return MODEL_CONTEXT_LIMITS.default;
}

/**
 * Token tracker for a session
 */
export class TokenTracker {
  private model: string;
  private messages: MessageTokens[] = [];
  private totalInput = 0;
  private totalOutput = 0;

  constructor(model = 'default') {
    this.model = model;
  }

  /**
   * Track an input message (user or system)
   */
  trackInput(message: Message): number {
    const tokens = estimateMessageTokens(message, this.model);
    this.messages.push({
      role: message.role,
      content: message.content.slice(0, 100), // Store truncated for debugging
      tokens,
      timestamp: new Date(),
    });
    this.totalInput += tokens;
    return tokens;
  }

  /**
   * Track an output message (assistant)
   */
  trackOutput(message: Message): number {
    const tokens = estimateMessageTokens(message, this.model);
    this.messages.push({
      role: message.role,
      content: message.content.slice(0, 100),
      tokens,
      timestamp: new Date(),
    });
    this.totalOutput += tokens;
    return tokens;
  }

  /**
   * Track streaming output tokens
   */
  trackStreamingOutput(chunk: string): number {
    const tokens = estimateTokens(chunk, this.model);
    this.totalOutput += tokens;
    return tokens;
  }

  /**
   * Get session statistics
   */
  getStats(): SessionTokens {
    return {
      totalInput: this.totalInput,
      totalOutput: this.totalOutput,
      total: this.totalInput + this.totalOutput,
      messageBreakdown: [...this.messages],
    };
  }

  /**
   * Get context usage percentage
   */
  getContextUsage(currentMessages: Message[]): { used: number; limit: number; percentage: number } {
    const used = estimateConversationTokens(currentMessages, this.model);
    const limit = getContextLimit(this.model);
    const percentage = Math.round((used / limit) * 100);
    return { used, limit, percentage };
  }

  /**
   * Set model (changes token estimation)
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Reset session tracking
   */
  reset(): void {
    this.messages = [];
    this.totalInput = 0;
    this.totalOutput = 0;
  }
}
