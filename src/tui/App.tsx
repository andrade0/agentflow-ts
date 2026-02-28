import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { render, Box, Text, useInput, useApp, useStdout } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { loadConfig } from '../config';
import { createProviders, parseModelString } from '../providers';
import { loadAllSkills, matchSkills } from '../skills';
import type { Skill, Message, Provider } from '../types';
import { 
  SessionTracker, 
  formatCost, 
  simpleCompact 
} from '../context';

// Types
interface UIMessage {
  role: 'user' | 'assistant' | 'system' | 'skill';
  content: string;
  timestamp: Date;
}

interface AppProps {
  provider: Provider;
  skills: Skill[];
  model: string;
  providerName: string;
  maxBudget?: number;
}

// Colors
const colors = {
  primary: '#7C3AED',
  secondary: '#10B981',
  accent: '#F59E0B',
  error: '#EF4444',
  muted: '#6B7280',
};

// Header component
const Header: React.FC<{ provider: string; model: string }> = ({ provider, model }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Box>
      <Text bold color={colors.primary}>🚀 AgentFlow</Text>
      <Text color={colors.muted}> v0.1.0</Text>
    </Box>
    <Text color={colors.muted}>
      {provider}/{model} • Enter to send • /help for commands
    </Text>
  </Box>
);

// Message component
const MessageView: React.FC<{ message: UIMessage; isStreaming?: boolean }> = ({ message, isStreaming }) => {
  const roleStyles: Record<string, { color: string; label: string }> = {
    user: { color: colors.secondary, label: 'You' },
    assistant: { color: colors.primary, label: 'Agent' },
    system: { color: colors.muted, label: 'System' },
    skill: { color: colors.accent, label: '⚡ Skill' },
  };

  const style = roleStyles[message.role] || roleStyles.system;
  const time = message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color={style.color}>{style.label}</Text>
        <Text color={colors.muted}> {time}</Text>
        {isStreaming && message.role === 'assistant' && (
          <Text color={colors.primary}> <Spinner type="dots" /></Text>
        )}
      </Box>
      <Box marginLeft={0}>
        <Text wrap="wrap">{message.content}</Text>
      </Box>
    </Box>
  );
};

// Messages list component
const MessagesList: React.FC<{ messages: UIMessage[]; isStreaming: boolean }> = ({ messages, isStreaming }) => (
  <Box flexDirection="column" flexGrow={1}>
    {messages.map((msg, i) => (
      <MessageView 
        key={i} 
        message={msg} 
        isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'} 
      />
    ))}
  </Box>
);

// Enhanced Status bar component
const StatusBar: React.FC<{
  provider: string;
  model: string;
  messageCount: number;
  sessionDuration: string;
  lastSkill?: string;
  isStreaming: boolean;
  contextPercentage: number;
  tokenCount: number;
  cost: number;
  isLocal: boolean;
  budget?: number;
  budgetWarning?: string;
}> = ({ 
  provider, 
  model, 
  messageCount, 
  sessionDuration, 
  lastSkill, 
  isStreaming,
  contextPercentage,
  tokenCount,
  cost,
  isLocal,
  budget,
  budgetWarning,
}) => {
  // Determine context color
  let contextColor = colors.secondary;
  if (contextPercentage >= 90) contextColor = colors.error;
  else if (contextPercentage >= 70) contextColor = colors.accent;
  else if (contextPercentage >= 50) contextColor = colors.primary;
  
  // Format token count
  const formatTokens = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };
  
  return (
    <Box 
      borderStyle="single" 
      borderColor={colors.primary}
      paddingX={1}
      justifyContent="space-between"
      flexDirection="column"
    >
      <Box justifyContent="space-between">
        <Box>
          <Text backgroundColor={colors.primary} color="white"> {provider}/{model} </Text>
        </Box>
        <Box>
          {isStreaming ? (
            <Text color={colors.primary}><Spinner type="dots" /> Generating...</Text>
          ) : lastSkill ? (
            <Text color={colors.accent}>⚡ {lastSkill}</Text>
          ) : null}
        </Box>
        <Box>
          <Text color={colors.muted}>↑{messageCount} msgs • {sessionDuration}</Text>
        </Box>
      </Box>
      
      <Box justifyContent="space-between" marginTop={0}>
        <Box>
          <Text color={colors.muted}>Context: </Text>
          <Text color={contextColor}>{formatTokens(tokenCount)} ({contextPercentage}%)</Text>
        </Box>
        <Box>
          <Text color={colors.muted}>Cost: </Text>
          {isLocal ? (
            <Text color={colors.secondary}>FREE</Text>
          ) : (
            <Text color={cost > 1 ? colors.accent : colors.secondary}>
              {formatCost(cost)}
              {budget && ` / $${budget.toFixed(2)}`}
            </Text>
          )}
        </Box>
        {budgetWarning && (
          <Box>
            <Text color={colors.error}>{budgetWarning}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

// Help content
const HelpContent = () => (
  <Box flexDirection="column" borderStyle="round" borderColor={colors.primary} padding={1}>
    <Text bold color={colors.primary}>Available Commands</Text>
    <Text> </Text>
    <Text><Text bold>/help, /h</Text>      Show this help</Text>
    <Text><Text bold>/quit, /q</Text>      Exit the session</Text>
    <Text><Text bold>/clear, /c</Text>     Clear conversation</Text>
    <Text><Text bold>/model</Text> [name]  Show/change model</Text>
    <Text><Text bold>/provider</Text> [n]  Show/change provider</Text>
    <Text><Text bold>/status</Text>        Show session stats</Text>
    <Text><Text bold>/skills</Text>        List available skills</Text>
    <Text> </Text>
    <Text bold color={colors.primary}>Context & Costs</Text>
    <Text> </Text>
    <Text><Text bold>/context</Text>       Show context usage</Text>
    <Text><Text bold>/cost</Text>          Show session costs</Text>
    <Text><Text bold>/compact</Text> [f]   Compact history</Text>
    <Text><Text bold>/budget</Text> [n]    Show/set budget</Text>
    <Text> </Text>
    <Text color={colors.muted}>Ctrl+C to exit • Enter to send</Text>
  </Box>
);

// Context visualization component
const ContextView: React.FC<{ contextUsed: number; contextLimit: number; percentage: number }> = ({
  contextUsed,
  contextLimit,
  percentage,
}) => {
  const gridWidth = 40;
  const gridHeight = 3;
  const totalCells = gridWidth * gridHeight;
  const usedCells = Math.round((percentage / 100) * totalCells);
  
  // Determine color based on usage
  let cellColor = colors.secondary;
  if (percentage >= 90) cellColor = colors.error;
  else if (percentage >= 70) cellColor = colors.accent;
  else if (percentage >= 50) cellColor = colors.primary;
  
  const formatNum = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };
  
  // Create rows
  const rows = [];
  for (let row = 0; row < gridHeight; row++) {
    const cells = [];
    for (let col = 0; col < gridWidth; col++) {
      const cellIndex = row * gridWidth + col;
      const isUsed = cellIndex < usedCells;
      cells.push(
        <Text key={col} color={isUsed ? cellColor : colors.muted}>
          {isUsed ? '█' : '░'}
        </Text>
      );
    }
    rows.push(<Box key={row}>{cells}</Box>);
  }
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.primary} padding={1}>
      <Text bold color={colors.primary}>Context Usage</Text>
      <Text> </Text>
      <Box flexDirection="column">
        {rows}
      </Box>
      <Text> </Text>
      <Text>
        <Text color={cellColor}>{formatNum(contextUsed)}</Text>
        <Text color={colors.muted}> / {formatNum(contextLimit)} tokens ({percentage}%)</Text>
      </Text>
    </Box>
  );
};

// Cost view component
const CostView: React.FC<{
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  isLocal: boolean;
  budget?: number;
}> = ({ inputTokens, outputTokens, totalCost, isLocal, budget }) => {
  const formatNum = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.primary} padding={1}>
      <Text bold color={colors.primary}>Session Costs</Text>
      <Text> </Text>
      <Text>Input tokens:  {formatNum(inputTokens)}</Text>
      <Text>Output tokens: {formatNum(outputTokens)}</Text>
      <Text>Total tokens:  {formatNum(inputTokens + outputTokens)}</Text>
      <Text> </Text>
      {isLocal ? (
        <Text color={colors.secondary}>Cost: FREE (local model)</Text>
      ) : (
        <>
          <Text>Cost: {formatCost(totalCost)}</Text>
          {budget && (
            <Text color={colors.muted}>
              Budget: ${budget.toFixed(2)} ({Math.round((totalCost / budget) * 100)}% used)
            </Text>
          )}
        </>
      )}
    </Box>
  );
};

// Main App component
const App: React.FC<AppProps> = ({ provider, skills, model: initialModel, providerName: initialProvider, maxBudget: initialBudget }) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentModel, setCurrentModel] = useState(initialModel);
  const [currentProvider, setCurrentProvider] = useState(initialProvider);
  const [lastSkill, setLastSkill] = useState<string | undefined>();
  const [sessionStart] = useState(new Date());
  const [showHelp, setShowHelp] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [showCost, setShowCost] = useState(false);
  const [maxBudget, setMaxBudget] = useState(initialBudget);
  
  // Session tracker
  const sessionTracker = useMemo(() => new SessionTracker({
    model: currentModel,
    provider: currentProvider,
    maxBudget,
  }), []);
  
  // Update tracker when model/provider changes
  useEffect(() => {
    sessionTracker.setModel(currentModel, currentProvider);
  }, [currentModel, currentProvider, sessionTracker]);
  
  useEffect(() => {
    if (maxBudget) sessionTracker.setBudget(maxBudget);
  }, [maxBudget, sessionTracker]);

  // Calculate session duration
  const getSessionDuration = useCallback(() => {
    const diff = Date.now() - sessionStart.getTime();
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }, [sessionStart]);

  // Get session stats
  const getSessionStats = useCallback(() => {
    // Sync messages to tracker
    const apiMessages: Message[] = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    sessionTracker.setMessages(apiMessages);
    return sessionTracker.getStats();
  }, [messages, sessionTracker]);

  // Handle keyboard shortcuts
  useInput((char, key) => {
    if (key.ctrl && char === 'c') {
      exit();
    }
  });

  // Add system message
  const addSystemMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, {
      role: 'system',
      content,
      timestamp: new Date(),
    }]);
  }, []);

  // Handle command
  const handleCommand = useCallback((cmd: string) => {
    const parts = cmd.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    switch (command) {
      case '/quit':
      case '/exit':
      case '/q':
        exit();
        break;

      case '/help':
      case '/h':
      case '/?':
        setShowHelp(prev => !prev);
        setShowContext(false);
        setShowCost(false);
        break;

      case '/clear':
      case '/c':
        setMessages([]);
        sessionTracker.reset();
        addSystemMessage('Conversation cleared.');
        break;

      case '/model':
        if (parts[1]) {
          setCurrentModel(parts[1]);
          addSystemMessage(`Model changed to: ${parts[1]}`);
        } else {
          addSystemMessage(`Current model: ${currentModel}`);
        }
        break;

      case '/provider':
        if (parts[1]) {
          setCurrentProvider(parts[1]);
          addSystemMessage(`Provider changed to: ${parts[1]}`);
        } else {
          addSystemMessage(`Current provider: ${currentProvider}`);
        }
        break;

      case '/status': {
        const stats = getSessionStats();
        addSystemMessage(
          `Session Status\n──────────────\n` +
          `Provider: ${currentProvider}\n` +
          `Model: ${currentModel}\n` +
          `Messages: ${messages.length}\n` +
          `Duration: ${getSessionDuration()}\n` +
          `Tokens: ${stats.tokens.total.toLocaleString()} (${stats.tokens.contextPercentage}% of context)\n` +
          `Cost: ${stats.costs.isLocal ? 'FREE' : formatCost(stats.costs.current)}\n` +
          `Last Skill: ${lastSkill || 'None'}`
        );
        break;
      }

      case '/skills': {
        const skillList = skills.map(s => `• ${s.name}: ${s.description}`).join('\n');
        addSystemMessage(`Available Skills:\n${skillList || 'No skills loaded'}`);
        break;
      }

      case '/context':
        setShowContext(prev => !prev);
        setShowHelp(false);
        setShowCost(false);
        break;

      case '/cost':
        setShowCost(prev => !prev);
        setShowHelp(false);
        setShowContext(false);
        break;

      case '/compact': {
        const apiMsgs: Message[] = messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
        
        if (apiMsgs.length < 4) {
          addSystemMessage('Not enough messages to compact.');
        } else {
          const result = simpleCompact(apiMsgs, { focus: args || undefined, model: currentModel });
          addSystemMessage(
            `Compaction complete\n` +
            `Original: ${result.originalTokens.toLocaleString()} tokens\n` +
            `After: ${result.compactedTokens.toLocaleString()} tokens\n` +
            `Saved: ${result.savedTokens.toLocaleString()} tokens (${result.savedPercentage}%)`
          );
        }
        break;
      }

      case '/budget': {
        if (parts[1]) {
          const newBudget = parseFloat(parts[1]);
          if (!isNaN(newBudget) && newBudget > 0) {
            setMaxBudget(newBudget);
            addSystemMessage(`Budget set to: $${newBudget.toFixed(2)}`);
          } else {
            addSystemMessage('Invalid budget amount');
          }
        } else {
          if (maxBudget) {
            const s = getSessionStats();
            const remaining = Math.max(0, maxBudget - s.costs.current);
            addSystemMessage(
              `Budget: $${maxBudget.toFixed(2)}\n` +
              `Spent: ${formatCost(s.costs.current)}\n` +
              `Remaining: ${formatCost(remaining)}`
            );
          } else {
            addSystemMessage('No budget set. Use /budget <amount> to set one.');
          }
        }
        break;
      }

      default:
        addSystemMessage(`Unknown command: ${command}. Type /help for available commands.`);
    }
  }, [
    exit, currentModel, currentProvider, messages.length, 
    getSessionDuration, lastSkill, skills, addSystemMessage,
    sessionTracker, getSessionStats, maxBudget, messages
  ]);

  // Handle submit
  const handleSubmit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setInput('');
    setShowHelp(false);
    setShowContext(false);
    setShowCost(false);

    // Handle commands
    if (trimmed.startsWith('/')) {
      handleCommand(trimmed);
      return;
    }

    // Check budget
    const stats = getSessionStats();
    if (maxBudget && stats.costs.current >= maxBudget) {
      addSystemMessage('🛑 Budget exceeded! Cannot continue.');
      return;
    }

    // Add user message
    const userMsg: UIMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    sessionTracker.trackInput({ role: 'user', content: trimmed });

    // Check for skill match
    const matched = matchSkills(trimmed, skills);
    if (matched.length > 0) {
      const matchedSkill = matched[0].skill;
      setLastSkill(matchedSkill.name);
      setMessages(prev => [...prev, {
        role: 'skill',
        content: `Skill activated: ${matchedSkill.name}`,
        timestamp: new Date(),
      }]);
    }

    // Add empty assistant message for streaming
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }]);

    setIsStreaming(true);

    try {
      // Build messages for API
      const apiMessages: Message[] = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      
      apiMessages.push({ role: 'user', content: trimmed });

      // Stream response
      let fullResponse = '';
      for await (const chunk of provider.chat(apiMessages, { model: currentModel })) {
        fullResponse += chunk;
        sessionTracker.trackStreamingChunk(chunk);
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content = fullResponse;
          }
          return newMessages;
        });
      }
      
      // Track output
      sessionTracker.trackOutput({ role: 'assistant', content: fullResponse });
      
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsStreaming(false);
    }
  }, [
    messages, currentModel, provider, skills, handleCommand, 
    sessionTracker, addSystemMessage, getSessionStats, maxBudget
  ]);

  // Get current stats for status bar
  const stats = getSessionStats();

  return (
    <Box flexDirection="column" height={stdout?.rows || 24}>
      <Header provider={currentProvider} model={currentModel} />
      
      {showHelp && <HelpContent />}
      
      {showContext && (
        <ContextView 
          contextUsed={stats.tokens.contextUsed}
          contextLimit={stats.tokens.contextLimit}
          percentage={stats.tokens.contextPercentage}
        />
      )}
      
      {showCost && (
        <CostView
          inputTokens={stats.tokens.input}
          outputTokens={stats.tokens.output}
          totalCost={stats.costs.current}
          isLocal={stats.costs.isLocal}
          budget={maxBudget}
        />
      )}
      
      <MessagesList messages={messages} isStreaming={isStreaming} />
      
      <Box borderStyle="round" borderColor={colors.primary} paddingX={1}>
        <Text color={colors.secondary}>{'> '}</Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Type a message..."
        />
      </Box>
      
      <StatusBar
        provider={currentProvider}
        model={currentModel}
        messageCount={messages.length}
        sessionDuration={getSessionDuration()}
        lastSkill={lastSkill}
        isStreaming={isStreaming}
        contextPercentage={stats.tokens.contextPercentage}
        tokenCount={stats.tokens.contextUsed}
        cost={stats.costs.current}
        isLocal={stats.costs.isLocal}
        budget={maxBudget}
        budgetWarning={stats.costs.budgetWarning}
      />
    </Box>
  );
};

// Start function
export async function startTUI(options: { maxBudget?: number } = {}): Promise<void> {
  const config = await loadConfig();
  const modelString = config.defaults?.main || 'ollama/llama3.3:70b';
  const { provider: providerName, model } = parseModelString(modelString);
  
  const providers = createProviders(config.providers);
  const provider = providers.get(providerName);
  
  if (!provider) {
    console.error(`Failed to create provider: ${providerName}`);
    process.exit(1);
  }
  
  const skills = await loadAllSkills();

  render(
    <App 
      provider={provider} 
      skills={skills}
      model={model}
      providerName={providerName}
      maxBudget={options.maxBudget}
    />
  );
}

export default App;
