import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { parseSkillFile, loadSkillsFromDirectory, loadAllSkills } from '../src/skills/parser';
import { matchSkills, findBestSkill } from '../src/skills/matcher';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import type { Skill } from '../src/types';

const TEST_DIR = join(import.meta.dir, 'test-skills');

beforeAll(async () => {
  await mkdir(TEST_DIR, { recursive: true });
  
  // Create test skill files
  await writeFile(join(TEST_DIR, 'SKILL-brainstorming.md'), `---
name: brainstorming
description: Design phase before coding
trigger: (design|brainstorm|plan)
---
# Brainstorming

Explore the problem space.
{{input}}
`);

  await writeFile(join(TEST_DIR, 'SKILL-tdd.md'), `---
name: tdd
description: Test-driven development workflow
trigger: (test|tdd|red.green)
---
# TDD

Write tests first.
{{input}}
`);
});

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('parseSkillFile', () => {
  it('should parse skill with frontmatter', async () => {
    const skill = await parseSkillFile(join(TEST_DIR, 'SKILL-brainstorming.md'));
    
    expect(skill.name).toBe('brainstorming');
    expect(skill.description).toBe('Design phase before coding');
    expect(skill.trigger).toBe('(design|brainstorm|plan)');
    expect(skill.template).toContain('Explore the problem space');
  });
});

describe('loadSkillsFromDirectory', () => {
  it('should load all skills from directory', async () => {
    const skills = await loadSkillsFromDirectory(TEST_DIR);
    
    expect(skills.length).toBe(2);
    expect(skills.map(s => s.name).sort()).toEqual(['brainstorming', 'tdd']);
  });

  it('should return empty array for non-existent directory', async () => {
    const skills = await loadSkillsFromDirectory('/nonexistent');
    expect(skills).toEqual([]);
  });
});

describe('matchSkills', () => {
  const skills: Skill[] = [
    {
      name: 'brainstorming',
      description: 'Design phase before coding',
      trigger: '(design|brainstorm|plan)',
      template: '',
      frontmatter: {},
    },
    {
      name: 'tdd',
      description: 'Test-driven development workflow',
      trigger: '(test|tdd)',
      template: '',
      frontmatter: {},
    },
  ];

  it('should match by trigger pattern', () => {
    const results = matchSkills('Let me brainstorm this feature', skills);
    
    expect(results.length).toBe(1);
    expect(results[0].skill.name).toBe('brainstorming');
    expect(results[0].score).toBe(100);
  });

  it('should match by skill name', () => {
    const results = matchSkills('Use the tdd approach', skills);
    
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.skill.name === 'tdd')).toBe(true);
  });

  it('should return empty for no matches', () => {
    const results = matchSkills('Random unrelated text', skills);
    expect(results.length).toBe(0);
  });
});

describe('findBestSkill', () => {
  const skills: Skill[] = [
    {
      name: 'brainstorming',
      description: 'Design phase',
      trigger: '(design|brainstorm)',
      template: '',
      frontmatter: {},
    },
  ];

  it('should return best matching skill', () => {
    const skill = findBestSkill('design a new feature', skills);
    expect(skill?.name).toBe('brainstorming');
  });

  it('should return null for no match', () => {
    const skill = findBestSkill('random text', skills);
    expect(skill).toBeNull();
  });
});
