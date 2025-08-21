import { v4 as uuidv4 } from "uuid";
import { ChatMessage, Session, UploadedFileInfo } from "../types";
import { env } from "../config/env";

export class SessionStore {
  private sessions: Map<string, Session> = new Map();

  getOrCreate(sessionId?: string): Session {
    const id = sessionId || uuidv4();
    if (!this.sessions.has(id)) {
      this.sessions.set(id, {
        id,
        messages: [],
        uploadedFiles: [],
        context: {},
        lastActivity: Date.now(),
      });
    }
    const session = this.sessions.get(id)!;
    session.lastActivity = Date.now();
    return session;
  }

  addMessage(sessionId: string, message: ChatMessage): void {
    const session = this.getOrCreate(sessionId);
    session.messages.push(message);
  }

  addFile(sessionId: string, fileInfo: UploadedFileInfo): void {
    const session = this.getOrCreate(sessionId);
    session.uploadedFiles.push(fileInfo);
    session.context.currentFile = fileInfo;
  }

  find(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getSessionsSnapshot(): Array<{ id: string; session: Session }> {
    return Array.from(this.sessions.entries()).map(([id, session]) => ({ id, session }));
  }

  cleanupExpired(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActivity > env.SESSION_TIMEOUT) {
        this.sessions.delete(id);
      }
    }
  }
}
