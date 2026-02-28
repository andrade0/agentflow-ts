/**
 * Context Compaction - Summarize and compact conversation history
 */

import type { Message, Provider, ChatOptions } from '../types';
import { estimateConversationTokens, getContextLimit } from './tokens';

export interface CompactionOptions {
  /** Focus topic for compaction (optional) */
  focus?: string;
  /** Target token count after compaction */
  targetTokens?: number;
  /** Keep last N messages uncompacted */
  keepRecent?: number;
  /** Provider for summarization */
  provider?: Provider;
  /** Model for summarization */
  model?: string;
}

export interface CompactionResult {
  messages: Message[];
  originalTokens: number;
  compactedTokens: number;
  savedTokens: number;
  savedPercentage: number;
  summary?: string;
}

/**
 * Simple compaction: keep system + recent messages + truncate old ones
 */
export function simpleCompact(
  messages: Message[],
  options: CompactionOptions = {}
): CompactionResult {
  const { keepRecent = 4, targetTokens } = options;
  const model = options.model || 'default';
  
  const originalTokens = estimateConversationTokens(messages, model);
  const contextLimit = getContextLimit(model);
  const target = targetTokens || Math.floor(contextLimit * 0.5);
  
  // If already under target, no compaction needed
  if (originalTokens <= target) {
    return {
      messages,
      originalTokens,
      compactedTokens: originalTokens,
      savedTokens: 0,
      savedPercentage: 0,
    };
  }
  
  // Separate system message and others
  const systemMessage = messages.find(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');
  
  // Keep last N messages
  const recentMessages = nonSystemMessages.slice(-keepRecent);
  const oldMessages = nonSystemMessages.slice(0, -keepRecent);
  
  // Create summary of old messages
  let summaryContent = '';
  if (oldMessages.length > 0) {
    summaryContent = createLocalSummary(oldMessages, options.focus);
  }
  
  // Build compacted messages
  const compactedMessages: Message[] = [];
  
  if (systemMessage) {
    compactedMessages.push(systemMessage);
  }
  
  if (summaryContent) {
    compactedMessages.push({
      role: 'system',
      content: `[Previous conversation summary]:\n${summaryContent}`,
    });
  }
  
  compactedMessages.push(...recentMessages);
  
  const compactedTokens = estimateConversationTokens(compactedMessages, model);
  const savedTokens = originalTokens - compactedTokens;
  
  return {
    messages: compactedMessages,
    originalTokens,
    compactedTokens,
    savedTokens,
    savedPercentage: Math.round((savedTokens / originalTokens) * 100),
    summary: summaryContent,
  };
}

/**
 * Create a local summary without LLM (fast, for simple compaction)
 */
function createLocalSummary(messages: Message[], focus?: string): string {
  const summaryParts: string[] = [];
  
  // Extract key points from conversation
  let userQuestions: string[] = [];
  let assistantPoints: string[] = [];
  
  for (const msg of messages) {
    const content = msg.content.trim();
    
    if (msg.role === 'user') {
      // Extract user questions/requests (first sentence or first 100 chars)
      const firstSentence = content.split(/[.!?]/)[0];
      if (firstSentence.length > 10) {
        userQuestions.push(firstSentence.slice(0, 100));
      }
    } else if (msg.role === 'assistant') {
      // Extract key points (look for lists, important phrases)
      const lines = content.split('\n');
      for (const line of lines.slice(0, 3)) {
        if (line.match(/^[\-\*\d]/) || line.includes(':')) {
          assistantPoints.push(line.slice(0, 80));
        }
      }
    }
  }
  
  // Deduplicate and limit
  userQuestions = [...new Set(userQuestions)].slice(0, 5);
  assistantPoints = [...new Set(assistantPoints)].slice(0, 5);
  
  if (userQuestions.length > 0) {
    summaryParts.push(`Topics discussed: ${userQuestions.join('; ')}`);
  }
  
  if (assistantPoints.length > 0) {
    summaryParts.push(`Key points: ${assistantPoints.join('; ')}`);
  }
  
  if (focus) {
    summaryParts.push(`Current focus: ${focus}`);
  }
  
  return summaryParts.join('\n') || 'Previous conversation context.';
}

/**
 * LLM-powered compaction (uses provider to create better summary)
 */
export async function llmCompact(
  messages: Message[],
  options: CompactionOptions
): Promise<CompactionResult> {
  const { provider, model, focus, keepRecent = 4 } = options;
  
  if (!provider || !model) {
    // Fallback to simple compaction
    return simpleCompact(messages, options);
  }
  
  const originalTokens = estimateConversationTokens(messages, model);
  
  // Separate messages
  const systemMessage = messages.find(m => m.role === 'system');
  const nonSystemMessages = messages.filter(m => m.role !== 'system');
  const recentMessages = nonSystemMessages.slice(-keepRecent);
  const oldMessages = nonSystemMessages.slice(0, -keepRecent);
  
  if (oldMessages.length === 0) {
    return simpleCompact(messages, options);
  }
  
  // Create conversation text for summarization
  const conversationText = oldMessages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');
  
  // Build summarization prompt
  let prompt = `Summarize this conversation concisely, preserving key information, decisions, and context needed for continuation:

${conversationText}

Create a brief summary (max 200 words) that captures:
- Main topics discussed
- Key decisions or conclusions
- Important context for future messages`;

  if (focus) {
    prompt += `\n\nFocus particularly on information related to: ${focus}`;
  }

  // Get summary from LLM
  let summary = '';
  try {
    const summaryMessages: Message[] = [{ role: 'user', content: prompt }];
    
    for await (const chunk of provider.chat(summaryMessages, { 
      model, 
      maxTokens: 500,
      temperature: 0.3 
    })) {
      summary += chunk;
    }
  } catch (error) {
    // Fallback to local summary on error
    summary = createLocalSummary(oldMessages, focus);
  }
  
  // Build compacted messages
  const compactedMessages: Message[] = [];
  
  if (systemMessage) {
    compactedMessages.push(systemMessage);
  }
  
  compactedMessages.push({
    role: 'system',
    content: `[Conversation Summary]:\n${summary}`,
  });
  
  compactedMessages.push(...recentMessages);
  
  const compactedTokens = estimateConversationTokens(compactedMessages, model);
  const savedTokens = originalTokens - compactedTokens;
  
  return {
    messages: compactedMessages,
    originalTokens,
    compactedTokens,
    savedTokens,
    savedPercentage: Math.round((savedTokens / originalTokens) * 100),
    summary,
  };
}

/**
 * Auto-compact if needed (based on context usage)
 */
export async function autoCompactIfNeeded(
  messages: Message[],
  options: CompactionOptions & { threshold?: number } = {}
): Promise<CompactionResult | null> {
  const { threshold = 80, model = 'default' } = options;
  
  const currentTokens = estimateConversationTokens(messages, model);
  const contextLimit = getContextLimit(model);
  const usagePercentage = (currentTokens / contextLimit) * 100;
  
  if (usagePercentage < threshold) {
    return null; // No compaction needed
  }
  
  // Use LLM compaction if provider available, otherwise simple
  if (options.provider && options.model) {
    return llmCompact(messages, options);
  }
  
  return simpleCompact(messages, options);
}
