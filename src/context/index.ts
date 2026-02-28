/**
 * Context Management Module
 * 
 * Provides token counting, cost calculation, context visualization,
 * and conversation compaction for LLM sessions.
 */

// Token counting
export {
  estimateTokens,
  estimateMessageTokens,
  estimateConversationTokens,
  getContextLimit,
  TokenTracker,
  MODEL_CONTEXT_LIMITS,
  type TokenUsage,
  type SessionTokens,
  type MessageTokens,
} from './tokens';

// Cost calculation
export {
  calculateCost,
  formatCost,
  formatCostWithColor,
  getModelPricing,
  CostTracker,
  MODEL_PRICING,
  type ModelPricing,
  type CostStats,
  type SessionCosts,
  type CostEntry,
} from './costs';

// Context compaction
export {
  simpleCompact,
  llmCompact,
  autoCompactIfNeeded,
  type CompactionOptions,
  type CompactionResult,
} from './compaction';

// Visualization
export {
  visualizeContext,
  visualizeCosts,
  getContextStatusBar,
  type ContextVisualization,
} from './visualization';

/**
 * Unified session tracker combining tokens and costs
 */
import type { Message, Provider } from '../types';
import { TokenTracker } from './tokens';
import { CostTracker } from './costs';
import { visualizeContext, visualizeCosts, getContextStatusBar } from './visualization';
import { simpleCompact, llmCompact, type CompactionResult } from './compaction';

export interface SessionStats {
  tokens: {
    input: number;
    output: number;
    total: number;
    contextUsed: number;
    contextLimit: number;
    contextPercentage: number;
  };
  costs: {
    current: number;
    isLocal: boolean;
    budgetRemaining?: number;
    budgetWarning?: string;
  };
  messages: number;
  duration: number;
}

export class SessionTracker {
  private tokenTracker: TokenTracker;
  private costTracker: CostTracker;
  private model: string;
  private provider: string;
  private startTime: Date;
  private messages: Message[] = [];
  private maxBudget?: number;

  constructor(options: {
    model?: string;
    provider?: string;
    maxBudget?: number;
  } = {}) {
    this.model = options.model || 'default';
    this.provider = options.provider || 'ollama';
    this.maxBudget = options.maxBudget;
    this.startTime = new Date();
    
    this.tokenTracker = new TokenTracker(this.model);
    this.costTracker = new CostTracker(this.model, this.provider, this.maxBudget);
  }

  /**
   * Track an input message
   */
  trackInput(message: Message): void {
    this.tokenTracker.trackInput(message);
    this.messages.push(message);
  }

  /**
   * Track an output message
   */
  trackOutput(message: Message): void {
    const tokens = this.tokenTracker.trackOutput(message);
    this.messages.push(message);
    
    // Track incrementally (only the new output)
    this.costTracker.track(0, tokens);
  }

  /**
   * Track streaming output
   */
  trackStreamingChunk(chunk: string): void {
    this.tokenTracker.trackStreamingOutput(chunk);
  }

  /**
   * Finalize a turn (call after streaming complete)
   */
  finalizeTurn(inputTokens: number, outputTokens: number): void {
    this.costTracker.track(inputTokens, outputTokens);
  }

  /**
   * Get comprehensive session stats
   */
  getStats(): SessionStats {
    const tokenStats = this.tokenTracker.getStats();
    const contextUsage = this.tokenTracker.getContextUsage(this.messages);
    const costStats = this.costTracker.getStats();
    const isLocal = this.provider === 'ollama';
    
    return {
      tokens: {
        input: tokenStats.totalInput,
        output: tokenStats.totalOutput,
        total: tokenStats.total,
        contextUsed: contextUsage.used,
        contextLimit: contextUsage.limit,
        contextPercentage: contextUsage.percentage,
      },
      costs: {
        current: costStats.currentCost,
        isLocal,
        budgetRemaining: costStats.budgetRemaining,
        budgetWarning: costStats.budgetWarning,
      },
      messages: this.messages.length,
      duration: Date.now() - this.startTime.getTime(),
    };
  }

  /**
   * Get context visualization
   */
  visualizeContext(): string {
    const cost = this.costTracker.getCurrentCost();
    return visualizeContext(this.messages, this.model, cost).full;
  }

  /**
   * Get cost visualization
   */
  visualizeCosts(): string {
    const tokenStats = this.tokenTracker.getStats();
    const cost = this.costTracker.getCurrentCost();
    return visualizeCosts(
      tokenStats.totalInput,
      tokenStats.totalOutput,
      cost,
      this.model,
      this.maxBudget
    );
  }

  /**
   * Get status bar info
   */
  getStatusBar(): { text: string; color: string } {
    const cost = this.costTracker.getCurrentCost();
    return getContextStatusBar(this.messages, this.model, cost, this.maxBudget);
  }

  /**
   * Check if budget is exceeded
   */
  isBudgetExceeded(): boolean {
    return this.costTracker.isBudgetExceeded();
  }

  /**
   * Get budget warning
   */
  getBudgetWarning(): string | undefined {
    return this.costTracker.getBudgetWarning();
  }

  /**
   * Compact the conversation
   */
  async compact(options: {
    focus?: string;
    provider?: Provider;
  } = {}): Promise<CompactionResult> {
    const result = options.provider
      ? await llmCompact(this.messages, {
          focus: options.focus,
          provider: options.provider,
          model: this.model,
        })
      : simpleCompact(this.messages, {
          focus: options.focus,
          model: this.model,
        });
    
    // Update internal messages
    this.messages = result.messages;
    
    return result;
  }

  /**
   * Set messages (for external sync)
   */
  setMessages(messages: Message[]): void {
    this.messages = messages;
  }

  /**
   * Update model/provider
   */
  setModel(model: string, provider?: string): void {
    this.model = model;
    if (provider) this.provider = provider;
    this.tokenTracker.setModel(model);
    this.costTracker.setModel(model, provider);
  }

  /**
   * Set budget
   */
  setBudget(maxBudget: number): void {
    this.maxBudget = maxBudget;
    this.costTracker.setBudget(maxBudget);
  }

  /**
   * Reset session
   */
  reset(): void {
    this.tokenTracker.reset();
    this.costTracker.reset();
    this.messages = [];
    this.startTime = new Date();
  }
}
