import { describe, it, expect } from 'bun:test';
import { createAgentContext, addMessage, updateProgress, getConversationHistory } from '../src/agents/context';
import type { AgentFlowConfig, Message } from '../src/types';

const mockConfig: AgentFlowConfig = {
  providers: {},
  defaults: { main: 'test/model' },
};

describe('createAgentContext', () => {
  it('should create empty context', () => {
    const ctx = createAgentContext(mockConfig);
    
    expect(ctx.messages).toEqual([]);
    expect(ctx.taskProgress).toBe(0);
    expect(ctx.skills).toEqual([]);
    expect(ctx.config).toBe(mockConfig);
  });

  it('should include skills if provided', () => {
    const skills = [{ name: 'test', description: 'test', template: '', frontmatter: {} }];
    const ctx = createAgentContext(mockConfig, skills);
    
    expect(ctx.skills).toEqual(skills);
  });
});

describe('addMessage', () => {
  it('should add message to context', () => {
    let ctx = createAgentContext(mockConfig);
    const msg: Message = { role: 'user', content: 'Hello' };
    
    ctx = addMessage(ctx, msg);
    
    expect(ctx.messages.length).toBe(1);
    expect(ctx.messages[0]).toEqual(msg);
    expect(ctx.lastMessage).toBe('Hello');
  });

  it('should preserve immutability', () => {
    const ctx = createAgentContext(mockConfig);
    const newCtx = addMessage(ctx, { role: 'user', content: 'Test' });
    
    expect(ctx.messages.length).toBe(0);
    expect(newCtx.messages.length).toBe(1);
  });
});

describe('updateProgress', () => {
  it('should update progress', () => {
    let ctx = createAgentContext(mockConfig);
    ctx = updateProgress(ctx, 50);
    
    expect(ctx.taskProgress).toBe(50);
  });

  it('should clamp progress to 0-100', () => {
    let ctx = createAgentContext(mockConfig);
    
    ctx = updateProgress(ctx, 150);
    expect(ctx.taskProgress).toBe(100);
    
    ctx = updateProgress(ctx, -10);
    expect(ctx.taskProgress).toBe(0);
  });
});

describe('getConversationHistory', () => {
  it('should return all messages within token limit', () => {
    let ctx = createAgentContext(mockConfig);
    ctx = addMessage(ctx, { role: 'system', content: 'You are helpful' });
    ctx = addMessage(ctx, { role: 'user', content: 'Hello' });
    ctx = addMessage(ctx, { role: 'assistant', content: 'Hi there!' });
    
    const history = getConversationHistory(ctx);
    
    expect(history.length).toBe(3);
    expect(history[0].role).toBe('system');
  });

  it('should always include system message', () => {
    let ctx = createAgentContext(mockConfig);
    ctx = addMessage(ctx, { role: 'system', content: 'System prompt' });
    
    // Add many messages
    for (let i = 0; i < 100; i++) {
      ctx = addMessage(ctx, { role: 'user', content: `Message ${i}`.repeat(100) });
    }
    
    const history = getConversationHistory(ctx, 1000);
    
    expect(history[0].role).toBe('system');
  });
});
