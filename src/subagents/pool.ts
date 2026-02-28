import type { Provider, SubagentTask, AgentFlowConfig } from '../types';
import { createAgentContext } from '../agents/context';
import { runAgent } from '../agents/runner';
import { loadAllSkills } from '../skills';
import { createProvider, parseModelString } from '../providers';

export interface SubagentPoolOptions {
  maxConcurrent?: number;
  defaultModel?: string;
  config: AgentFlowConfig;
}

export class SubagentPool {
  private tasks: Map<string, SubagentTask> = new Map();
  private running: Set<string> = new Set();
  private maxConcurrent: number;
  private defaultModel: string;
  private config: AgentFlowConfig;

  constructor(options: SubagentPoolOptions) {
    this.maxConcurrent = options.maxConcurrent || 3;
    this.defaultModel = options.defaultModel || options.config.defaults?.subagent || 'ollama/llama3.3:70b';
    this.config = options.config;
  }

  async spawn(prompt: string, model?: string): Promise<string> {
    const taskId = crypto.randomUUID();
    const taskModel = model || this.defaultModel;

    const task: SubagentTask = {
      id: taskId,
      prompt,
      model: taskModel,
      status: 'pending',
    };

    this.tasks.set(taskId, task);
    
    // Start if under limit
    if (this.running.size < this.maxConcurrent) {
      this.runTask(taskId);
    }

    return taskId;
  }

  private async runTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'running';
    this.running.add(taskId);

    try {
      const { provider: providerName, model } = parseModelString(task.model!);
      const providerConfig = this.config.providers[providerName];
      
      if (!providerConfig) {
        throw new Error(`Provider ${providerName} not configured`);
      }

      const provider = createProvider(providerName, providerConfig);
      const skills = await loadAllSkills();
      const context = createAgentContext(this.config, skills);

      const finalContext = await runAgent(task.prompt, context, {
        provider,
        model,
        systemPrompt: 'You are a focused subagent. Complete the assigned task efficiently and concisely.',
        maxTurns: 5,
        onChunk: () => {}, // Silent mode
      });

      task.result = finalContext.lastMessage;
      task.status = 'completed';
    } catch (error) {
      task.error = error instanceof Error ? error.message : String(error);
      task.status = 'failed';
    } finally {
      this.running.delete(taskId);
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.running.size >= this.maxConcurrent) return;

    for (const [taskId, task] of this.tasks) {
      if (task.status === 'pending') {
        this.runTask(taskId);
        if (this.running.size >= this.maxConcurrent) break;
      }
    }
  }

  getTask(taskId: string): SubagentTask | undefined {
    return this.tasks.get(taskId);
  }

  async waitFor(taskId: string, timeoutMs = 60000): Promise<SubagentTask> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const task = this.tasks.get(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      if (task.status === 'completed' || task.status === 'failed') {
        return task;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Task ${taskId} timed out`);
  }

  getAllTasks(): SubagentTask[] {
    return Array.from(this.tasks.values());
  }

  getRunningCount(): number {
    return this.running.size;
  }

  getPendingCount(): number {
    return Array.from(this.tasks.values()).filter(t => t.status === 'pending').length;
  }
}
