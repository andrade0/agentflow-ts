import type { Skill } from '../types';

export interface MatchResult {
  skill: Skill;
  score: number;
  reason: string;
}

export function matchSkills(input: string, skills: Skill[]): MatchResult[] {
  const inputLower = input.toLowerCase();
  const results: MatchResult[] = [];

  for (const skill of skills) {
    let score = 0;
    let reason = '';

    // Check trigger pattern (highest priority)
    if (skill.trigger) {
      const triggerRegex = new RegExp(skill.trigger, 'i');
      if (triggerRegex.test(input)) {
        score = 100;
        reason = 'Trigger pattern matched';
      }
    }

    // Check skill name in input
    if (score === 0 && inputLower.includes(skill.name.toLowerCase())) {
      score = 80;
      reason = 'Skill name found in input';
    }

    // Keyword matching in description
    if (score === 0) {
      const descKeywords = extractKeywords(skill.description);
      const inputKeywords = extractKeywords(input);
      const matchedKeywords = descKeywords.filter(k => inputKeywords.includes(k));
      
      if (matchedKeywords.length > 0) {
        score = Math.min(60, matchedKeywords.length * 15);
        reason = `Matched keywords: ${matchedKeywords.join(', ')}`;
      }
    }

    if (score > 0) {
      results.push({ skill, score, reason });
    }
  }

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

export function findBestSkill(input: string, skills: Skill[]): Skill | null {
  const matches = matchSkills(input, skills);
  return matches.length > 0 ? matches[0].skill : null;
}
