// Session persistence types

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system' | 'skill';
  content: string;
  timestamp: string;
}

export interface Session {
  id: string;
  name?: string;
  messages: SessionMessage[];
  workdir: string;
  provider?: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionMetadata {
  id: string;
  name?: string;
  workdir: string;
  provider?: string;
  model?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}
