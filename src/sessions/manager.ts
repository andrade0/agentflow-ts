// Session persistence manager
import { join } from 'path';
import { homedir } from 'os';
import { mkdir, readdir, readFile, writeFile, unlink, stat } from 'fs/promises';
import type { Session, SessionMetadata, SessionMessage } from './types';

const SESSIONS_DIR = join(homedir(), '.agentflow', 'sessions');
const MAX_SESSIONS = 50;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class SessionManager {
  private sessionsDir: string;

  constructor(sessionsDir: string = SESSIONS_DIR) {
    this.sessionsDir = sessionsDir;
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.sessionsDir, { recursive: true });
  }

  private getSessionPath(id: string): string {
    return join(this.sessionsDir, `${id}.json`);
  }

  /**
   * Create a new session
   */
  create(workdir: string, provider?: string, model?: string): Session {
    const now = new Date().toISOString();
    return {
      id: generateId(),
      messages: [],
      workdir,
      provider,
      model,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * List all sessions with metadata
   */
  async list(): Promise<SessionMetadata[]> {
    await this.ensureDir();

    const files = await readdir(this.sessionsDir);
    const sessions: SessionMetadata[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const content = await readFile(join(this.sessionsDir, file), 'utf-8');
        const session: Session = JSON.parse(content);
        sessions.push({
          id: session.id,
          name: session.name,
          workdir: session.workdir,
          provider: session.provider,
          model: session.model,
          messageCount: session.messages.length,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        });
      } catch {
        // Skip invalid files
      }
    }

    // Sort by updatedAt descending
    return sessions.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Get a session by ID
   */
  async get(id: string): Promise<Session | null> {
    await this.ensureDir();

    try {
      const content = await readFile(this.getSessionPath(id), 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Find a session by name or ID (partial match)
   */
  async find(nameOrId: string): Promise<Session | null> {
    const sessions = await this.list();
    
    // Exact ID match
    const exactId = sessions.find(s => s.id === nameOrId);
    if (exactId) return this.get(exactId.id);

    // Exact name match
    const exactName = sessions.find(s => s.name === nameOrId);
    if (exactName) return this.get(exactName.id);

    // Partial ID match (prefix)
    const partialId = sessions.find(s => s.id.startsWith(nameOrId));
    if (partialId) return this.get(partialId.id);

    // Partial name match (case-insensitive)
    const partialName = sessions.find(s => 
      s.name?.toLowerCase().includes(nameOrId.toLowerCase())
    );
    if (partialName) return this.get(partialName.id);

    return null;
  }

  /**
   * Save a session
   */
  async save(session: Session): Promise<void> {
    await this.ensureDir();

    session.updatedAt = new Date().toISOString();
    await writeFile(
      this.getSessionPath(session.id),
      JSON.stringify(session, null, 2)
    );
  }

  /**
   * Delete a session
   */
  async delete(id: string): Promise<boolean> {
    try {
      await unlink(this.getSessionPath(id));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the latest session for a workdir
   */
  async getLatest(workdir: string): Promise<Session | null> {
    const sessions = await this.list();
    const matching = sessions.filter(s => s.workdir === workdir);
    
    if (matching.length === 0) return null;
    return this.get(matching[0].id);
  }

  /**
   * Rename a session
   */
  async rename(id: string, name: string): Promise<boolean> {
    const session = await this.get(id);
    if (!session) return false;

    session.name = name;
    await this.save(session);
    return true;
  }

  /**
   * Add a message to a session
   */
  async addMessage(session: Session, message: SessionMessage): Promise<void> {
    session.messages.push(message);
    await this.save(session);
  }

  /**
   * Cleanup old sessions (keep most recent MAX_SESSIONS)
   */
  async cleanup(): Promise<number> {
    const sessions = await this.list();
    
    if (sessions.length <= MAX_SESSIONS) return 0;

    const toDelete = sessions.slice(MAX_SESSIONS);
    let deleted = 0;

    for (const session of toDelete) {
      if (await this.delete(session.id)) {
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Convert session messages to API format
   */
  static toApiMessages(session: Session): Array<{ role: 'user' | 'assistant'; content: string }> {
    return session.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
  }

  /**
   * Format session for display
   */
  static formatSession(meta: SessionMetadata): string {
    const name = meta.name || '(unnamed)';
    const date = new Date(meta.updatedAt);
    const timeStr = date.toLocaleString();
    const dir = meta.workdir.replace(homedir(), '~');
    
    return `${meta.id.slice(0, 8)} | ${name.padEnd(20)} | ${meta.messageCount} msgs | ${dir} | ${timeStr}`;
  }
}

// Singleton instance
let _sessionManager: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!_sessionManager) {
    _sessionManager = new SessionManager();
  }
  return _sessionManager;
}
