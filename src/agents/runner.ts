import type { Provider, Message, AgentContext, ContinueDecision } from '../types';
import { addMessage, updateProgress, getConversationHistory } from './context';
import { matchSkills, runSkill } from '../skills';

export interface AgentRunnerOptions {
  provider: Provider;
  model: string;
  systemPrompt?: string;
  maxTurns?: number;
  onChunk?: (chunk: string) => void;
  shouldContinue?: (context: AgentContext) => Promise<ContinueDecision>;
}

export async function runAgent(
  initialPrompt: string,
  context: AgentContext,
  options: AgentRunnerOptions
): Promise<AgentContext> {
  const {
    provider,
    model,
    systemPrompt,
    maxTurns = 10,
    onChunk = (chunk) => process.stdout.write(chunk),
    shouldContinue,
  } = options;

  // Initialize with system prompt
  if (systemPrompt) {
    context = addMessage(context, { role: 'system', content: systemPrompt });
  }

  // Add user prompt
  context = addMessage(context, { role: 'user', content: initialPrompt });

  let turnCount = 0;
  let stopCount = 0;
  const stopWindow: number[] = [];

  while (turnCount < maxTurns) {
    turnCount++;

    // Check for matching skills
    const skillMatches = matchSkills(context.lastMessage || initialPrompt, context.skills);
    
    if (skillMatches.length > 0 && skillMatches[0].score >= 80) {
      const bestSkill = skillMatches[0].skill;
      console.log(`\n[Executing skill: ${bestSkill.name}]\n`);
      
      const result = await runSkill(bestSkill, context.lastMessage || initialPrompt, provider, model);
      context = addMessage(context, { role: 'assistant', content: result.output });
    } else {
      // Regular chat completion
      const messages = getConversationHistory(context);
      let response = '';

      const generator = provider.chat(messages, { model });
      for await (const chunk of generator) {
        response += chunk;
        onChunk(chunk);
      }
      onChunk('\n');

      context = addMessage(context, { role: 'assistant', content: response });
    }

    context = updateProgress(context, (turnCount / maxTurns) * 100);

    // Check if we should continue
    if (shouldContinue) {
      const decision = await shouldContinue(context);
      
      if (!decision.continue) {
        // Anti-loop: track stops in window
        const now = Date.now();
        stopWindow.push(now);
        
        // Remove stops older than 5 minutes
        const fiveMinAgo = now - 5 * 60 * 1000;
        while (stopWindow.length > 0 && stopWindow[0] < fiveMinAgo) {
          stopWindow.shift();
        }

        if (stopWindow.length >= 3) {
          console.log('\n[Circuit breaker: too many stops in 5 minutes]');
          break;
        }

        console.log(`\n[Stopping: ${decision.reason}]`);
        break;
      }
    } else {
      // No continue checker, stop after one turn
      break;
    }
  }

  return context;
}

export async function chat(
  message: string,
  context: AgentContext,
  provider: Provider,
  model: string
): Promise<{ response: string; context: AgentContext }> {
  context = addMessage(context, { role: 'user', content: message });
  
  const messages = getConversationHistory(context);
  let response = '';

  const generator = provider.chat(messages, { model });
  for await (const chunk of generator) {
    response += chunk;
    process.stdout.write(chunk);
  }
  console.log();

  context = addMessage(context, { role: 'assistant', content: response });

  return { response, context };
}
