/**
 * Cost Calculator - Track and estimate API costs
 */

export interface ModelPricing {
  inputPer1M: number;  // USD per 1M input tokens
  outputPer1M: number; // USD per 1M output tokens
}

// Pricing in USD per 1M tokens (as of 2024)
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI GPT-4
  'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.00 },
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'gpt-4-turbo': { inputPer1M: 10.00, outputPer1M: 30.00 },
  'gpt-4': { inputPer1M: 30.00, outputPer1M: 60.00 },
  'gpt-4-32k': { inputPer1M: 60.00, outputPer1M: 120.00 },
  'gpt-3.5-turbo': { inputPer1M: 0.50, outputPer1M: 1.50 },
  
  // Anthropic Claude
  'claude-3-opus': { inputPer1M: 15.00, outputPer1M: 75.00 },
  'claude-3-sonnet': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'claude-3-haiku': { inputPer1M: 0.25, outputPer1M: 1.25 },
  'claude-3.5-sonnet': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'claude-3.5-haiku': { inputPer1M: 1.00, outputPer1M: 5.00 },
  
  // Groq (free tier, but track for comparison)
  'llama-3.3-70b-versatile': { inputPer1M: 0.59, outputPer1M: 0.79 },
  'llama-3.1-70b-versatile': { inputPer1M: 0.59, outputPer1M: 0.79 },
  'llama-3.1-8b-instant': { inputPer1M: 0.05, outputPer1M: 0.08 },
  'mixtral-8x7b-32768': { inputPer1M: 0.24, outputPer1M: 0.24 },
  'gemma-7b-it': { inputPer1M: 0.07, outputPer1M: 0.07 },
  
  // Together AI
  'together/llama-3.3-70b': { inputPer1M: 0.88, outputPer1M: 0.88 },
  'together/mixtral-8x7b': { inputPer1M: 0.60, outputPer1M: 0.60 },
  
  // Local models (Ollama) - FREE!
  'ollama': { inputPer1M: 0, outputPer1M: 0 },
  'llama3.3': { inputPer1M: 0, outputPer1M: 0 },
  'llama3.3:70b': { inputPer1M: 0, outputPer1M: 0 },
  'codellama': { inputPer1M: 0, outputPer1M: 0 },
  'mistral': { inputPer1M: 0, outputPer1M: 0 },
  'mixtral': { inputPer1M: 0, outputPer1M: 0 },
  
  // Default (estimate for unknown models)
  'default': { inputPer1M: 1.00, outputPer1M: 2.00 },
};

export interface CostStats {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
  isLocal: boolean;
}

export interface SessionCosts {
  currentCost: number;
  estimatedTotal: number;
  breakdown: CostEntry[];
  budgetRemaining?: number;
  budgetWarning?: string;
}

export interface CostEntry {
  timestamp: Date;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  model: string;
}

/**
 * Get pricing for a model
 */
export function getModelPricing(model: string, provider?: string): ModelPricing {
  const key = model.toLowerCase();
  
  // Check if it's a local model (Ollama)
  if (provider === 'ollama') {
    return MODEL_PRICING.ollama;
  }
  
  // Direct match
  if (MODEL_PRICING[key]) {
    return MODEL_PRICING[key];
  }
  
  // Partial match
  for (const [modelKey, pricing] of Object.entries(MODEL_PRICING)) {
    if (key.includes(modelKey) || modelKey.includes(key)) {
      return pricing;
    }
  }
  
  return MODEL_PRICING.default;
}

/**
 * Calculate cost for tokens
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
  provider?: string
): CostStats {
  const pricing = getModelPricing(model, provider);
  const isLocal = pricing.inputPer1M === 0 && pricing.outputPer1M === 0;
  
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    inputTokens,
    outputTokens,
    model,
    isLocal,
  };
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost === 0) return '$0.00 (free)';
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Format cost with color indicator
 */
export function formatCostWithColor(cost: number, budget?: number): { text: string; color: string } {
  const text = formatCost(cost);
  
  if (cost === 0) {
    return { text, color: 'green' };
  }
  
  if (budget) {
    const percentage = (cost / budget) * 100;
    if (percentage >= 90) return { text, color: 'red' };
    if (percentage >= 70) return { text, color: 'yellow' };
  }
  
  if (cost > 1) return { text, color: 'yellow' };
  return { text, color: 'green' };
}

/**
 * Cost tracker for a session
 */
export class CostTracker {
  private model: string;
  private provider: string;
  private entries: CostEntry[] = [];
  private totalCost = 0;
  private maxBudget?: number;

  constructor(model = 'default', provider = 'ollama', maxBudget?: number) {
    this.model = model;
    this.provider = provider;
    this.maxBudget = maxBudget;
  }

  /**
   * Track a conversation turn
   */
  track(inputTokens: number, outputTokens: number): CostStats {
    const stats = calculateCost(inputTokens, outputTokens, this.model, this.provider);
    
    this.entries.push({
      timestamp: new Date(),
      inputTokens,
      outputTokens,
      cost: stats.totalCost,
      model: this.model,
    });
    
    this.totalCost += stats.totalCost;
    
    return stats;
  }

  /**
   * Get session cost statistics
   */
  getStats(): SessionCosts {
    const stats: SessionCosts = {
      currentCost: this.totalCost,
      estimatedTotal: this.totalCost,
      breakdown: [...this.entries],
    };
    
    if (this.maxBudget) {
      stats.budgetRemaining = Math.max(0, this.maxBudget - this.totalCost);
      
      const percentage = (this.totalCost / this.maxBudget) * 100;
      if (percentage >= 100) {
        stats.budgetWarning = '🛑 Budget exceeded!';
      } else if (percentage >= 90) {
        stats.budgetWarning = '⚠️ Budget almost exhausted (>90%)';
      } else if (percentage >= 70) {
        stats.budgetWarning = '📊 Budget usage at 70%';
      }
    }
    
    return stats;
  }

  /**
   * Check if budget is exceeded
   */
  isBudgetExceeded(): boolean {
    if (!this.maxBudget) return false;
    return this.totalCost >= this.maxBudget;
  }

  /**
   * Get budget warning if needed
   */
  getBudgetWarning(): string | undefined {
    return this.getStats().budgetWarning;
  }

  /**
   * Set model and provider
   */
  setModel(model: string, provider?: string): void {
    this.model = model;
    if (provider) this.provider = provider;
  }

  /**
   * Set max budget
   */
  setBudget(maxBudget: number): void {
    this.maxBudget = maxBudget;
  }

  /**
   * Get current cost
   */
  getCurrentCost(): number {
    return this.totalCost;
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.entries = [];
    this.totalCost = 0;
  }
}
