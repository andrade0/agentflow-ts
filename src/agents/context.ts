import type { AgentContext, Message, Skill, AgentFlowConfig } from '../types';

export function createAgentContext(config: AgentFlowConfig, skills: Skill[] = []): AgentContext {
  return {
    messages: [],
    taskProgress: 0,
    skills,
    config,
  };
}

export function addMessage(context: AgentContext, message: Message): AgentContext {
  return {
    ...context,
    messages: [...context.messages, message],
    lastMessage: message.content,
  };
}

export function updateProgress(context: AgentContext, progress: number): AgentContext {
  return {
    ...context,
    taskProgress: Math.min(100, Math.max(0, progress)),
  };
}

export function getConversationHistory(context: AgentContext, maxTokens = 8000): Message[] {
  // Simple token estimation: ~4 chars per token
  const estimatedTokensPerChar = 0.25;
  let totalTokens = 0;
  const result: Message[] = [];

  // Always include system message if present
  const systemMessage = context.messages.find(m => m.role === 'system');
  if (systemMessage) {
    totalTokens += systemMessage.content.length * estimatedTokensPerChar;
  }

  // Add messages from most recent, respecting token limit
  const nonSystemMessages = context.messages.filter(m => m.role !== 'system').reverse();
  const includedMessages: Message[] = [];
  
  for (const msg of nonSystemMessages) {
    const msgTokens = msg.content.length * estimatedTokensPerChar;
    if (totalTokens + msgTokens > maxTokens) break;
    includedMessages.unshift(msg);
    totalTokens += msgTokens;
  }

  // System message first, then others in order
  if (systemMessage) {
    result.push(systemMessage);
  }
  result.push(...includedMessages);

  return result;
}
