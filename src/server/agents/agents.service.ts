import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

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

/**
 * Agents service: session + history storage only.
 * Conversation is done via frontend -> Gateway (WebSocket) -> agent; NestJS is not in the chat path.
 */
@Injectable()
export class AgentsService {
    private sessions = new Map<string, AgentSession>();
    private messageHistory = new Map<string, ChatMessage[]>();
    private eventListeners = new Map<string, Set<(data: any) => void>>();

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

    async createSession(options?: {
        workspace?: string;
        provider?: string;
        model?: string;
        title?: string;
    }): Promise<AgentSession> {
        const sessionId = randomUUID();
        const session: AgentSession = {
            id: sessionId,
            createdAt: Date.now(),
            lastActiveAt: Date.now(),
            messageCount: 0,
            status: 'idle',
            workspace: options?.workspace,
            provider: options?.provider,
            model: options?.model,
            title: options?.title,
            preview: '',
        };
        this.sessions.set(sessionId, session);
        this.messageHistory.set(sessionId, []);
        return session;
    }

    getSessions(): AgentSession[] {
        return Array.from(this.sessions.values());
    }

    getSession(sessionId: string): AgentSession | undefined {
        return this.sessions.get(sessionId);
    }

    async deleteSession(sessionId: string): Promise<boolean> {
        this.sessions.delete(sessionId);
        this.messageHistory.delete(sessionId);
        return true;
    }

    getMessageHistory(sessionId: string): ChatMessage[] {
        return this.messageHistory.get(sessionId) || [];
    }

    addAssistantMessage(sessionId: string, content: string): void {
        const history = this.messageHistory.get(sessionId) || [];
        const assistantMessage: ChatMessage = {
            id: randomUUID(),
            sessionId,
            role: 'assistant',
            content,
            timestamp: Date.now(),
        };
        history.push(assistantMessage);
        this.messageHistory.set(sessionId, history);

        const session = this.sessions.get(sessionId);
        if (session) {
            session.status = 'idle';
            session.lastActiveAt = Date.now();
        }
    }

    /**
     * Append a message to session history (frontend syncs after talking via Gateway WebSocket).
     */
    appendMessage(
        sessionId: string,
        role: 'user' | 'assistant',
        content: string,
        options?: { toolCalls?: any[]; contentParts?: any[] },
    ): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        const history = this.messageHistory.get(sessionId) || [];
        const msg: ChatMessage = {
            id: randomUUID(),
            sessionId,
            role,
            content,
            timestamp: Date.now(),
        };
        if (role === 'assistant' && options?.toolCalls) msg.toolCalls = options.toolCalls;
        history.push(msg);
        this.messageHistory.set(sessionId, history);

        session.lastActiveAt = Date.now();
        if (role === 'assistant') session.status = 'idle';
    }
}
