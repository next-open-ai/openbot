import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { agentManager } from '../../agent/agent-manager.js';
import { DatabaseService } from '../database/database.service.js';

export interface AgentSession {
    id: string;
    createdAt: number;
    lastActiveAt: number;
    messageCount: number;
    status: 'idle' | 'active' | 'error';
    workspace?: string;
    provider?: string;
    model?: string;
    title?: string;
    preview?: string;
}

export interface ChatMessage {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    toolCalls?: any[];
}

interface SessionRow {
    id: string;
    created_at: number;
    last_active_at: number;
    message_count: number;
    status: string;
    workspace: string | null;
    provider: string | null;
    model: string | null;
    title: string | null;
    preview: string | null;
}

interface MessageRow {
    id: string;
    session_id: string;
    role: string;
    content: string;
    timestamp: number;
    tool_calls_json: string | null;
}

/**
 * Agents service: session + history storage in SQLite.
 * Conversation is done via frontend -> Gateway (WebSocket) -> agent; NestJS is not in the chat path.
 */
@Injectable()
export class AgentsService {
    private eventListeners = new Map<string, Set<(data: any) => void>>();

    constructor(private readonly db: DatabaseService) {}

    addEventListener(event: string, listener: (data: any) => void): () => void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event)!.add(listener);
        return () => {
            const listeners = this.eventListeners.get(event);
            if (listeners) listeners.delete(listener);
        };
    }

    private emitEvent(event: string, payload: any) {
        const listeners = this.eventListeners.get(event);
        if (listeners) listeners.forEach((l) => l(payload));
    }

    private rowToSession(r: SessionRow): AgentSession {
        return {
            id: r.id,
            createdAt: r.created_at,
            lastActiveAt: r.last_active_at,
            messageCount: r.message_count,
            status: r.status as AgentSession['status'],
            workspace: r.workspace ?? undefined,
            provider: r.provider ?? undefined,
            model: r.model ?? undefined,
            title: r.title ?? undefined,
            preview: r.preview ?? undefined,
        };
    }

    private rowToMessage(r: MessageRow): ChatMessage {
        const msg: ChatMessage = {
            id: r.id,
            sessionId: r.session_id,
            role: r.role as ChatMessage['role'],
            content: r.content,
            timestamp: r.timestamp,
        };
        if (r.tool_calls_json) {
            try {
                msg.toolCalls = JSON.parse(r.tool_calls_json);
            } catch (_) {}
        }
        return msg;
    }

    async createSession(options?: {
        workspace?: string;
        provider?: string;
        model?: string;
        title?: string;
    }): Promise<AgentSession> {
        const sessionId = randomUUID();
        const now = Date.now();
        const workspace = options?.workspace ?? 'default';
        const session: AgentSession = {
            id: sessionId,
            createdAt: now,
            lastActiveAt: now,
            messageCount: 0,
            status: 'idle',
            workspace,
            provider: options?.provider,
            model: options?.model,
            title: options?.title,
            preview: '',
        };
        this.db.run(
            `INSERT INTO sessions (id, created_at, last_active_at, message_count, status, workspace, provider, model, title, preview)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                session.id,
                session.createdAt,
                session.lastActiveAt,
                session.messageCount,
                session.status,
                workspace,
                session.provider ?? null,
                session.model ?? null,
                session.title ?? null,
                session.preview ?? null,
            ],
        );
        return session;
    }

    getSessions(): AgentSession[] {
        const rows = this.db.all<SessionRow>('SELECT * FROM sessions ORDER BY last_active_at DESC');
        return rows.map((r) => this.rowToSession(r));
    }

    getSession(sessionId: string): AgentSession | undefined {
        const r = this.db.get<SessionRow>('SELECT * FROM sessions WHERE id = ?', [sessionId]);
        return r ? this.rowToSession(r) : undefined;
    }

    async deleteSession(sessionId: string): Promise<boolean> {
        agentManager.deleteSession(sessionId);
        const result = this.db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
        return result.changes > 0;
    }

    getMessageHistory(sessionId: string): ChatMessage[] {
        const rows = this.db.all<MessageRow>(
            'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC',
            [sessionId],
        );
        return rows.map((r) => this.rowToMessage(r));
    }

    addAssistantMessage(sessionId: string, content: string): void {
        const id = randomUUID();
        const now = Date.now();
        this.db.run(
            `INSERT INTO chat_messages (id, session_id, role, content, timestamp, tool_calls_json) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, sessionId, 'assistant', content, now, null],
        );
        this.db.run(
            'UPDATE sessions SET last_active_at = ?, status = ?, message_count = message_count + 1 WHERE id = ?',
            [now, 'idle', sessionId],
        );
    }

    appendMessage(
        sessionId: string,
        role: 'user' | 'assistant',
        content: string,
        options?: { toolCalls?: any[]; contentParts?: any[] },
    ): void {
        const session = this.getSession(sessionId);
        if (!session) return;

        const id = randomUUID();
        const now = Date.now();
        const toolCallsJson = role === 'assistant' && options?.toolCalls ? JSON.stringify(options.toolCalls) : null;
        this.db.run(
            `INSERT INTO chat_messages (id, session_id, role, content, timestamp, tool_calls_json) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, sessionId, role, content, now, toolCallsJson],
        );
        this.db.run(
            'UPDATE sessions SET last_active_at = ?, status = ?, message_count = message_count + 1 WHERE id = ?',
            [now, role === 'assistant' ? 'idle' : session.status, sessionId],
        );
    }
}

