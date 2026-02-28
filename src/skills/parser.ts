import matter from 'gray-matter';
import { readFile, readdir } from 'fs/promises';
import { join, basename } from 'path';
import type { Skill } from '../types';

export async function parseSkillFile(filePath: string): Promise<Skill> {
  const content = await readFile(filePath, 'utf-8');
  const { data, content: template } = matter(content);

  const name = data.name || basename(filePath, '.md').replace('SKILL-', '').toLowerCase();
  const description = data.description || extractDescription(template);
  const trigger = data.trigger;

  return {
    name,
    description,
    trigger,
    template: template.trim(),
    frontmatter: data as Record<string, unknown>,
  };
}

function extractDescription(content: string): string {
  // Extract first paragraph or sentence as description
  const lines = content.split('\n').filter(line => line.trim());
  const firstLine = lines[0] || '';
  
  // Remove markdown headers
  const cleaned = firstLine.replace(/^#+\s*/, '').trim();
  
  // Truncate if too long
  return cleaned.length > 200 ? cleaned.slice(0, 197) + '...' : cleaned;
}

export async function loadSkillsFromDirectory(directory: string): Promise<Skill[]> {
  const skills: Skill[] = [];

  try {
    const files = await readdir(directory);
    const skillFiles = files.filter(f => 
      f.endsWith('.md') && 
      (f.startsWith('SKILL') || f.toLowerCase().includes('skill'))
    );

    for (const file of skillFiles) {
      try {
        const skill = await parseSkillFile(join(directory, file));
        skills.push(skill);
      } catch (error) {
        console.warn(`Failed to parse skill ${file}:`, error);
      }
    }
  } catch {
    // Directory doesn't exist or isn't readable
  }

  return skills;
}

export async function loadAllSkills(skillPaths: string[] = []): Promise<Skill[]> {
  const defaultPaths = [
    join(process.cwd(), '.agentflow', 'skills'),
    join(process.cwd(), 'skills'),
  ];

  const allPaths = [...skillPaths, ...defaultPaths];
  const skills: Skill[] = [];
  const seenNames = new Set<string>();

  for (const path of allPaths) {
    const dirSkills = await loadSkillsFromDirectory(path);
    for (const skill of dirSkills) {
      if (!seenNames.has(skill.name)) {
        seenNames.add(skill.name);
        skills.push(skill);
      }
    }
  }

  return skills;
}
