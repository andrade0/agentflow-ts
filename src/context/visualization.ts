/**
 * Context Visualization - Display context usage with colored grid
 */

import type { Message } from '../types';
import { estimateConversationTokens, getContextLimit, estimateMessageTokens } from './tokens';
import { formatCost } from './costs';

// ANSI color codes for terminal
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m',
  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgGray: '\x1b[100m',
};

export interface ContextVisualization {
  grid: string;
  stats: string;
  breakdown: string;
  full: string;
}

/**
 * Get color based on usage percentage
 */
function getUsageColor(percentage: number): { fg: string; bg: string; label: string } {
  if (percentage >= 90) {
    return { fg: ANSI.red, bg: ANSI.bgRed, label: 'CRITICAL' };
  }
  if (percentage >= 70) {
    return { fg: ANSI.yellow, bg: ANSI.bgYellow, label: 'HIGH' };
  }
  if (percentage >= 50) {
    return { fg: ANSI.cyan, bg: ANSI.bgBlue, label: 'MODERATE' };
  }
  return { fg: ANSI.green, bg: ANSI.bgGreen, label: 'LOW' };
}

/**
 * Create a colored bar for visualization
 */
function createBar(used: number, total: number, width: number): string {
  const percentage = Math.min(100, (used / total) * 100);
  const filledWidth = Math.round((percentage / 100) * width);
  const emptyWidth = width - filledWidth;
  
  const color = getUsageColor(percentage);
  
  const filled = '█'.repeat(filledWidth);
  const empty = '░'.repeat(emptyWidth);
  
  return `${color.fg}${filled}${ANSI.gray}${empty}${ANSI.reset}`;
}

/**
 * Create a grid visualization of context usage
 */
function createGrid(used: number, total: number, gridWidth = 40, gridHeight = 5): string {
  const totalCells = gridWidth * gridHeight;
  const usedCells = Math.round((used / total) * totalCells);
  
  const lines: string[] = [];
  let cellIndex = 0;
  
  for (let row = 0; row < gridHeight; row++) {
    let line = '';
    for (let col = 0; col < gridWidth; col++) {
      const isUsed = cellIndex < usedCells;
      const percentage = (cellIndex / totalCells) * 100;
      
      if (isUsed) {
        const color = getUsageColor(percentage);
        line += `${color.fg}█${ANSI.reset}`;
      } else {
        line += `${ANSI.gray}░${ANSI.reset}`;
      }
      cellIndex++;
    }
    lines.push(line);
  }
  
  return lines.join('\n');
}

/**
 * Format number with K/M suffix
 */
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Create context visualization
 */
export function visualizeContext(
  messages: Message[],
  model: string,
  sessionCost?: number
): ContextVisualization {
  const used = estimateConversationTokens(messages, model);
  const limit = getContextLimit(model);
  const percentage = Math.round((used / limit) * 100);
  const available = limit - used;
  const color = getUsageColor(percentage);
  
  // Create grid
  const grid = createGrid(used, limit);
  
  // Create bar
  const bar = createBar(used, limit, 30);
  
  // Create stats
  const statsLines = [
    `${ANSI.bold}Context Usage${ANSI.reset}`,
    `──────────────────────────────────────`,
    `${bar} ${color.fg}${percentage}%${ANSI.reset}`,
    ``,
    `${ANSI.cyan}Used:${ANSI.reset}      ${formatNumber(used)} tokens`,
    `${ANSI.gray}Available:${ANSI.reset} ${formatNumber(available)} tokens`,
    `${ANSI.gray}Limit:${ANSI.reset}     ${formatNumber(limit)} tokens`,
    `${ANSI.gray}Model:${ANSI.reset}     ${model}`,
    `${ANSI.gray}Status:${ANSI.reset}    ${color.fg}${color.label}${ANSI.reset}`,
  ];
  
  if (sessionCost !== undefined) {
    statsLines.push(`${ANSI.gray}Cost:${ANSI.reset}      ${formatCost(sessionCost)}`);
  }
  
  const stats = statsLines.join('\n');
  
  // Create breakdown by message role
  const roleBreakdown: Record<string, { count: number; tokens: number }> = {
    system: { count: 0, tokens: 0 },
    user: { count: 0, tokens: 0 },
    assistant: { count: 0, tokens: 0 },
  };
  
  for (const msg of messages) {
    const tokens = estimateMessageTokens(msg, model);
    if (!roleBreakdown[msg.role]) {
      roleBreakdown[msg.role] = { count: 0, tokens: 0 };
    }
    roleBreakdown[msg.role].count++;
    roleBreakdown[msg.role].tokens += tokens;
  }
  
  const breakdownLines = [
    `${ANSI.bold}Token Breakdown by Role${ANSI.reset}`,
    `──────────────────────────────────────`,
  ];
  
  for (const [role, data] of Object.entries(roleBreakdown)) {
    if (data.count > 0) {
      const rolePercent = Math.round((data.tokens / used) * 100);
      const roleColor = role === 'user' ? ANSI.green : role === 'assistant' ? ANSI.cyan : ANSI.yellow;
      breakdownLines.push(
        `${roleColor}${role.padEnd(10)}${ANSI.reset} ${data.count.toString().padStart(3)} msgs │ ${formatNumber(data.tokens).padStart(6)} tokens │ ${rolePercent}%`
      );
    }
  }
  
  const breakdown = breakdownLines.join('\n');
  
  // Full visualization
  const fullLines = [
    ``,
    `${ANSI.bold}╭─────────────────────────────────────────╮${ANSI.reset}`,
    `${ANSI.bold}│          Context Visualization          │${ANSI.reset}`,
    `${ANSI.bold}╰─────────────────────────────────────────╯${ANSI.reset}`,
    ``,
    grid,
    ``,
    stats,
    ``,
    breakdown,
    ``,
  ];
  
  return {
    grid,
    stats,
    breakdown,
    full: fullLines.join('\n'),
  };
}

/**
 * Create a compact status for status bar
 */
export function getContextStatusBar(
  messages: Message[],
  model: string,
  sessionCost?: number,
  budget?: number
): { text: string; color: string } {
  const used = estimateConversationTokens(messages, model);
  const limit = getContextLimit(model);
  const percentage = Math.round((used / limit) * 100);
  
  let text = `${formatNumber(used)}/${formatNumber(limit)} (${percentage}%)`;
  
  if (sessionCost !== undefined) {
    text += ` │ ${formatCost(sessionCost)}`;
    
    if (budget) {
      const budgetPercent = Math.round((sessionCost / budget) * 100);
      text += ` [${budgetPercent}% of $${budget.toFixed(2)}]`;
    }
  }
  
  // Return color name for ink
  let inkColor = 'green';
  if (percentage >= 90) inkColor = 'red';
  else if (percentage >= 70) inkColor = 'yellow';
  else if (percentage >= 50) inkColor = 'cyan';
  
  return { text, color: inkColor };
}

/**
 * Create cost visualization
 */
export function visualizeCosts(
  inputTokens: number,
  outputTokens: number,
  totalCost: number,
  model: string,
  budget?: number
): string {
  const lines = [
    ``,
    `${ANSI.bold}╭─────────────────────────────────────────╮${ANSI.reset}`,
    `${ANSI.bold}│            Session Costs                │${ANSI.reset}`,
    `${ANSI.bold}╰─────────────────────────────────────────╯${ANSI.reset}`,
    ``,
    `${ANSI.cyan}Input Tokens:${ANSI.reset}  ${formatNumber(inputTokens)}`,
    `${ANSI.cyan}Output Tokens:${ANSI.reset} ${formatNumber(outputTokens)}`,
    `${ANSI.cyan}Total Tokens:${ANSI.reset}  ${formatNumber(inputTokens + outputTokens)}`,
    ``,
    `${ANSI.bold}Model:${ANSI.reset} ${model}`,
    `${ANSI.bold}Total Cost:${ANSI.reset} ${totalCost === 0 ? `${ANSI.green}FREE (local model)${ANSI.reset}` : formatCost(totalCost)}`,
  ];
  
  if (budget) {
    const remaining = Math.max(0, budget - totalCost);
    const usedPercent = Math.round((totalCost / budget) * 100);
    const bar = createBar(totalCost, budget, 20);
    
    lines.push(``);
    lines.push(`${ANSI.bold}Budget:${ANSI.reset}`);
    lines.push(`${bar} ${usedPercent}%`);
    lines.push(`${ANSI.gray}Remaining:${ANSI.reset} ${formatCost(remaining)} of ${formatCost(budget)}`);
    
    if (usedPercent >= 90) {
      lines.push(`${ANSI.red}${ANSI.bold}⚠️ Budget almost exhausted!${ANSI.reset}`);
    }
  }
  
  lines.push(``);
  
  return lines.join('\n');
}
