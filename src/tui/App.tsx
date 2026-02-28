import React, { useState, useEffect, useCallback, useRef } from 'react';
import { render, Box, Text, useInput, useApp, useStdout } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { Config, loadConfig } from '../config';
import { createProvider, Provider } from '../providers';
import { SkillManager, Skill } from '../skills';
import { Session, SessionManager, getSessionManager, SessionMetadata } from '../sessions';

// Types
interface Message {
  role: 'user' | 'assistant' | 'system' | 'skill';
  content: string;
  timestamp: Date;
}

interface AppProps {
  config: Config;
  provider: Provider;
  skillManager: SkillManager;
  initialSession?: Session;
  forkSession?: boolean;
}

interface StartTUIOptions {
  continueSession?: boolean;
  resumeSession?: string;
  forkSession?: boolean;
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
      {provider}/{model} • Ctrl+Enter to send • /help for commands
    </Text>
  </Box>
);

// Message component
const MessageView: React.FC<{ message: Message; isStreaming?: boolean }> = ({ message, isStreaming }) => {
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
const MessagesList: React.FC<{ messages: Message[]; isStreaming: boolean }> = ({ messages, isStreaming }) => (
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

// Status bar component
const StatusBar: React.FC<{
  provider: string;
  model: string;
  messageCount: number;
  sessionDuration: string;
  lastSkill?: string;
  isStreaming: boolean;
}> = ({ provider, model, messageCount, sessionDuration, lastSkill, isStreaming }) => (
  <Box 
    borderStyle="single" 
    borderColor={colors.primary}
    paddingX={1}
    justifyContent="space-between"
  >
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
);

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
    <Text><Text bold>/compact</Text>       Compact history</Text>
    <Text> </Text>
    <Text color={colors.muted}>Ctrl+C to exit • Enter to send</Text>
  </Box>
);

// Main App component
const App: React.FC<AppProps> = ({ config, provider, skillManager, initialSession, forkSession }) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const sessionManager = useRef(getSessionManager());
  
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentModel, setCurrentModel] = useState(config.defaults?.model || 'llama3.3');
  const [currentProvider, setCurrentProvider] = useState(config.defaults?.provider || 'ollama');
  const [lastSkill, setLastSkill] = useState<string | undefined>();
  const [sessionStart] = useState(new Date());
  const [showHelp, setShowHelp] = useState(false);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [sessionsList, setSessionsList] = useState<SessionMetadata[] | null>(null);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      let session: Session;
      
      if (initialSession && !forkSession) {
        // Resume existing session
        session = initialSession;
        // Restore messages
        const restoredMessages: Message[] = initialSession.messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp),
        }));
        setMessages(restoredMessages);
        if (initialSession.model) setCurrentModel(initialSession.model);
        if (initialSession.provider) setCurrentProvider(initialSession.provider);
      } else if (initialSession && forkSession) {
        // Fork: create new session with messages from original
        session = sessionManager.current.create(
          process.cwd(),
          currentProvider,
          currentModel
        );
        session.messages = [...initialSession.messages];
        session.name = initialSession.name ? `${initialSession.name} (fork)` : undefined;
        // Restore messages
        const restoredMessages: Message[] = initialSession.messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp),
        }));
        setMessages(restoredMessages);
      } else {
        // New session
        session = sessionManager.current.create(
          process.cwd(),
          currentProvider,
          currentModel
        );
      }
      
      setCurrentSession(session);
      await sessionManager.current.save(session);
    };

    initSession();
  }, []);

  // Calculate session duration
  const getSessionDuration = useCallback(() => {
    const diff = Date.now() - sessionStart.getTime();
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }, [sessionStart]);

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

  // Save message to session
  const saveMessageToSession = useCallback(async (msg: Message) => {
    if (!currentSession) return;
    
    currentSession.messages.push({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
    });
    await sessionManager.current.save(currentSession);
  }, [currentSession]);

  // Load sessions list
  const loadSessionsList = useCallback(async () => {
    const sessions = await sessionManager.current.list();
    setSessionsList(sessions);
  }, []);

  // Handle command
  const handleCommand = useCallback((cmd: string) => {
    const parts = cmd.split(/\s+/);
    const command = parts[0].toLowerCase();

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
        break;

      case '/clear':
      case '/c':
        setMessages([]);
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

      case '/status':
        addSystemMessage(`Session Status\n──────────────\nProvider: ${currentProvider}\nModel: ${currentModel}\nMessages: ${messages.length}\nDuration: ${getSessionDuration()}\nLast Skill: ${lastSkill || 'None'}`);
        break;

      case '/skills':
        const skills = skillManager.list();
        const skillList = skills.map(s => `• ${s.name}: ${s.description}`).join('\n');
        addSystemMessage(`Available Skills:\n${skillList || 'No skills loaded'}`);
        break;

      case '/compact':
        addSystemMessage('Conversation compacted (not yet implemented)');
        break;

      case '/sessions':
        loadSessionsList();
        break;

      case '/resume':
        if (parts[1]) {
          sessionManager.current.find(parts[1]).then(session => {
            if (session) {
              // Restore messages
              const restoredMessages: Message[] = session.messages.map(m => ({
                role: m.role as Message['role'],
                content: m.content,
                timestamp: new Date(m.timestamp),
              }));
              setMessages(restoredMessages);
              setCurrentSession(session);
              if (session.model) setCurrentModel(session.model);
              if (session.provider) setCurrentProvider(session.provider);
              addSystemMessage(`Resumed session: ${session.name || session.id.slice(0, 8)}`);
            } else {
              addSystemMessage(`Session not found: ${parts[1]}`);
            }
          });
        } else {
          loadSessionsList();
          addSystemMessage('Use /resume <id> to resume a session, or select from the list above.');
        }
        break;

      case '/rename':
        if (currentSession) {
          const newName = parts.slice(1).join(' ').trim();
          if (newName) {
            currentSession.name = newName;
            sessionManager.current.save(currentSession);
            addSystemMessage(`Session renamed to: ${newName}`);
          } else {
            addSystemMessage(`Current session: ${currentSession.name || '(unnamed)'}\nUsage: /rename <name>`);
          }
        }
        break;

      case '/session':
        if (currentSession) {
          const name = currentSession.name || '(unnamed)';
          const id = currentSession.id.slice(0, 8);
          const msgCount = currentSession.messages.length;
          addSystemMessage(`Current Session\n──────────────\nID: ${id}\nName: ${name}\nMessages: ${msgCount}\nWorkdir: ${currentSession.workdir}`);
        }
        break;

      default:
        addSystemMessage(`Unknown command: ${command}. Type /help for available commands.`);
    }
  }, [exit, currentModel, currentProvider, messages.length, getSessionDuration, lastSkill, skillManager, addSystemMessage, currentSession, loadSessionsList]);

  // Handle submit
  const handleSubmit = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setInput('');

    // Handle commands
    if (trimmed.startsWith('/')) {
      handleCommand(trimmed);
      return;
    }

    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    saveMessageToSession(userMessage);

    // Check for skill match
    const matchedSkill = skillManager.match(trimmed);
    if (matchedSkill) {
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
      const apiMessages = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      
      apiMessages.push({ role: 'user', content: trimmed });

      // Stream response
      let fullResponse = '';
      for await (const chunk of provider.chat(apiMessages, { model: currentModel })) {
        fullResponse += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content = fullResponse;
          }
          return newMessages;
        });
      }

      // Save assistant message to session
      const assistantMessage: Message = {
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date(),
      };
      saveMessageToSession(assistantMessage);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsStreaming(false);
    }
  }, [messages, currentModel, provider, skillManager, handleCommand, saveMessageToSession]);

  return (
    <Box flexDirection="column" height={stdout?.rows || 24}>
      <Header provider={currentProvider} model={currentModel} />
      
      {showHelp && <HelpContent />}
      
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
      />
    </Box>
  );
};

// Start function
export async function startTUI(): Promise<void> {
  const config = await loadConfig();
  const provider = createProvider(config);
  const skillManager = new SkillManager(config.skills?.paths || []);
  await skillManager.load();

  render(<App config={config} provider={provider} skillManager={skillManager} />);
}

export default App;
