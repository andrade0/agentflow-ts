import type { Skill, Message, Provider } from '../types';

export interface SkillRunResult {
  output: string;
  tokensUsed?: number;
  duration: number;
}

export async function runSkill(
  skill: Skill,
  input: string,
  provider: Provider,
  model: string,
  context: Record<string, string> = {}
): Promise<SkillRunResult> {
  const startTime = Date.now();

  // Build prompt from skill template
  const prompt = interpolateTemplate(skill.template, {
    input,
    ...context,
  });

  // Build messages
  const messages: Message[] = [
    {
      role: 'system',
      content: `You are executing the "${skill.name}" skill. Follow the instructions precisely.`,
    },
    {
      role: 'user',
      content: prompt,
    },
  ];

  // Stream response
  let output = '';
  const generator = provider.chat(messages, { model });

  for await (const chunk of generator) {
    output += chunk;
    process.stdout.write(chunk);
  }

  console.log(); // Newline after streaming

  const duration = Date.now() - startTime;

  return {
    output,
    duration,
  };
}

function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] || `{{${name}}}`);
}

export async function runSkillSilent(
  skill: Skill,
  input: string,
  provider: Provider,
  model: string,
  context: Record<string, string> = {}
): Promise<SkillRunResult> {
  const startTime = Date.now();

  const prompt = interpolateTemplate(skill.template, {
    input,
    ...context,
  });

  const messages: Message[] = [
    {
      role: 'system',
      content: `You are executing the "${skill.name}" skill. Follow the instructions precisely.`,
    },
    {
      role: 'user',
      content: prompt,
    },
  ];

  let output = '';
  const generator = provider.chat(messages, { model });

  for await (const chunk of generator) {
    output += chunk;
  }

  const duration = Date.now() - startTime;

  return {
    output,
    duration,
  };
}
