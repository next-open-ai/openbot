import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import WebSocket from 'ws';
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

@Injectable()
export class AgentsService implements OnModuleInit, OnModuleDestroy {
    private gatewayWs: WebSocket | null = null;
    private sessions = new Map<string, AgentSession>();
    private messageHistory = new Map<string, ChatMessage[]>();
    private pendingRequests = new Map<string, any>();
    private eventListeners = new Map<string, Set<(data: any) => void>>();
    private reconnectTimer: NodeJS.Timeout | null = null;
    private gatewayUrl = process.env.GATEWAY_URL || 'ws://localhost:3000';

    async onModuleInit() {
        await this.connectToGateway();
    }

    onModuleDestroy() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        if (this.gatewayWs) {
            this.gatewayWs.close();
        }
    }

    private async connectToGateway(): Promise<void> {
        console.log(`Connecting to OpenBot Gateway at ${this.gatewayUrl}...`);

        try {
            this.gatewayWs = new WebSocket(this.gatewayUrl);

            this.gatewayWs.on('open', () => {
                console.log('✅ Connected to OpenBot Gateway');
            });

            this.gatewayWs.on('message', (data: WebSocket.Data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleGatewayMessage(message);
                } catch (error) {
                    console.error('Error parsing gateway message:', error);
                }
            });

            this.gatewayWs.on('close', () => {
                console.log('Gateway connection closed, attempting to reconnect...');
                this.gatewayWs = null;
                this.reconnectTimer = setTimeout(() => this.connectToGateway(), 5000);
            });

            this.gatewayWs.on('error', (error) => {
                console.error('Gateway WebSocket error:', error);
                // Don't reject - just log and let reconnect handle it
                if (this.gatewayWs) {
                    this.gatewayWs.close();
                }
            });
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            // Schedule reconnect
            this.reconnectTimer = setTimeout(() => this.connectToGateway(), 5000);
        }
    }

    private responseBuffers = new Map<string, string>();

    private handleGatewayMessage(message: any) {
        // Only log non-chunk events to reduce noise；response 没有 event/method，用 type + id 避免打出 undefined
        if (message.event !== 'agent.chunk') {
            const label = message.type === 'response'
                ? `response id=${message.id ?? '?'}`
                : (message.event || message.method || message.type);
            console.log('Gateway message:', label);
        }

        // Handle responses to our requests
        if (message.type === 'response' && message.id) {
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                this.pendingRequests.delete(message.id);
                if (message.error) {
                    pending.reject(new Error(message.error.message));
                } else {
                    pending.resolve(message.result);
                }
            }
        }

        // Handle events
        if (message.type === 'event') {
            // Accumulate chunks for history
            if (message.event === 'agent.chunk') {
                const { sessionId, text } = message.payload;
                if (sessionId && text) {
                    const current = this.responseBuffers.get(sessionId) || '';
                    this.responseBuffers.set(sessionId, current + text);
                }
            }

            const listeners = this.eventListeners.get(message.event);
            if (listeners) {
                listeners.forEach(listener => listener(message.payload));
            }
        }
    }

    private sendGatewayRequest(method: string, params?: any, timeoutMs?: number): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.gatewayWs || this.gatewayWs.readyState !== WebSocket.OPEN) {
                reject(new Error('Gateway not connected'));
                return;
            }

            const id = randomUUID();
            const request = {
                type: 'request',
                id,
                method,
                params,
            };

            this.pendingRequests.set(id, { resolve, reject });
            this.gatewayWs.send(JSON.stringify(request));

            const timeout = timeoutMs ?? (method === 'agent.chat' ? this.agentChatTimeoutMs : 60000);
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`Request timeout (${timeout / 1000}s)`));
                }
            }, timeout);
        });
    }

    /** agent.chat 超时时间（毫秒），多轮工具调用可能很久，默认 5 分钟；可通过 AGENT_CHAT_TIMEOUT_MS 配置 */
    private get agentChatTimeoutMs(): number {
        const env = process.env.AGENT_CHAT_TIMEOUT_MS;
        if (env != null && /^\d+$/.test(env)) return parseInt(env, 10);
        return 5 * 60 * 1000;
    }

    addEventListener(event: string, listener: (data: any) => void): () => void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event)!.add(listener);

        // Return unsubscribe function
        return () => {
            const listeners = this.eventListeners.get(event);
            if (listeners) {
                listeners.delete(listener);
            }
        };
    }

    // Helper to emit local events
    private emitEvent(event: string, payload: any) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(listener => listener(payload));
        }
    }

    async createSession(options?: {
        workspace?: string;
        provider?: string;
        model?: string;
        title?: string;
    }): Promise<AgentSession> {
        const sessionId = randomUUID();

        // Connect to gateway with this session
        await this.sendGatewayRequest('connect', { sessionId });

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
        this.responseBuffers.delete(sessionId);
        return true;
    }

    async sendMessage(sessionId: string, message: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }

        // Add user message to history
        const userMessage: ChatMessage = {
            id: randomUUID(),
            sessionId,
            role: 'user',
            content: message,
            timestamp: Date.now(),
        };

        const history = this.messageHistory.get(sessionId) || [];
        history.push(userMessage);
        this.messageHistory.set(sessionId, history);

        // Update session
        session.lastActiveAt = Date.now();
        session.messageCount++;
        session.status = 'active';

        // Update title and preview if this is the first message
        if (!session.title || session.messageCount === 1) {
            const cleanMessage = message.trim();
            // Title: first sentence or first 50 chars
            const firstSentence = cleanMessage.split(/[.!?\n]/)[0].substring(0, 50);
            session.title = firstSentence || 'New Session';

            // Preview: first 100 chars
            session.preview = cleanMessage.substring(0, 100) + (cleanMessage.length > 100 ? '...' : '');
        } else if (session.messageCount < 5) {
            // Update preview occasionally in the beginning to have more context
            const cleanMessage = message.trim();
            session.preview = cleanMessage.substring(0, 100) + (cleanMessage.length > 100 ? '...' : '');
        }

        // Clear response buffer for this session
        this.responseBuffers.set(sessionId, '');

        try {
            // Send to gateway
            await this.sendGatewayRequest('agent.chat', {
                sessionId,
                message,
            });

            // Request completed - agent finish processing
            const fullContent = this.responseBuffers.get(sessionId) || '';

            // Save to history and update status
            this.addAssistantMessage(sessionId, fullContent);

            // Emit completion event for frontend
            this.emitEvent('message_complete', {
                sessionId,
                content: fullContent,
            });

        } catch (error) {
            console.error('Error sending message:', error);
            session.status = 'error';
            throw error;
        } finally {
            this.responseBuffers.delete(sessionId);
        }
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
}
