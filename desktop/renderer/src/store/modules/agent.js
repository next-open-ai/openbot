import { defineStore } from 'pinia';
import { agentAPI } from '@/api';
import socketService from '@/api/socket';

export const useAgentStore = defineStore('agent', {
    state: () => ({
        sessions: [],
        currentSession: null,
        messages: [],
        currentMessage: '',
        currentStreamParts: [], // Array of {type: 'text'|'tool', content?: string, toolId?: string}
        isStreaming: false,
        toolExecutions: [],
    }),

    getters: {
        activeSessions: (state) => state.sessions.filter(s => s.status !== 'error'),
        sessionById: (state) => (id) => state.sessions.find(s => s.id === id),
    },

    actions: {
        async fetchSessions() {
            try {
                const response = await agentAPI.getSessions();
                this.sessions = response.data.data;
            } catch (error) {
                console.error('Failed to fetch sessions:', error);
            }
        },

        async createSession(options = {}) {
            try {
                const payload = { agentId: 'default', workspace: 'default', ...options };
                const response = await agentAPI.createSession(payload);
                const session = response.data.data;
                if (!this.sessions.find((s) => s.id === session.id)) {
                    this.sessions.push(session);
                }
                return session;
            } catch (error) {
                console.error('Failed to create session:', error);
                throw error;
            }
        },

        async deleteSession(sessionId) {
            try {
                await agentAPI.deleteSession(sessionId);
                this.sessions = this.sessions.filter(s => s.id !== sessionId);
                if (this.currentSession?.id === sessionId) {
                    this.currentSession = null;
                    this.messages = [];
                }
            } catch (error) {
                console.error('Failed to delete session:', error);
                throw error;
            }
        },

        async selectSession(sessionId) {
            const fallback = this.sessions.find(s => s.id === sessionId);
            try {
                const response = await agentAPI.getSession(sessionId);
                const session = response?.data?.data ?? response?.data;
                if (session) {
                    this.currentSession = session;
                } else if (fallback) {
                    this.currentSession = fallback;
                } else {
                    throw new Error('Session not found');
                }

                const historyResponse = await agentAPI.getHistory(sessionId);
                const list = historyResponse?.data?.data ?? historyResponse?.data;
                this.messages = Array.isArray(list) ? list : [];

                await socketService.connectToSession(sessionId);
            } catch (error) {
                console.error('Failed to select session:', error);
                if (fallback) {
                    this.currentSession = fallback;
                    this.messages = [];
                    await socketService.connectToSession(sessionId);
                } else {
                    throw error;
                }
            }
        },

        clearCurrentSession() {
            this.currentSession = null;
            this.messages = [];
        },

        async cancelCurrentTurn() {
            if (!this.currentSession?.id || !this.isStreaming) return;
            try {
                await socketService.cancelAgent(this.currentSession.id);
            } catch (error) {
                console.error('Failed to cancel agent turn:', error);
            }
        },

        /**
         * @param {string} message
         * @param {{ targetAgentId?: string }} [options] - targetAgentId: 具体 agentId 或 "global"|"all"；不传则用 currentSession.agentId
         */
        async sendMessage(message, options = {}) {
            if (!message.trim()) return;

            // Lazy Session Creation: If no current session, create one now
            if (!this.currentSession) {
                try {
                    const title = message.trim().substring(0, 50);
                    const session = await this.createSession({ title });
                    this.currentSession = session;
                    await socketService.connectToSession(session.id);
                } catch (error) {
                    console.error('Failed to create lazy session:', error);
                    return;
                }
            }

            try {
                if (this.currentSession && socketService.currentSessionId !== this.currentSession.id) {
                    await socketService.connectToSession(this.currentSession.id);
                }

                const userMessage = {
                    id: Date.now().toString(),
                    role: 'user',
                    content: message,
                    timestamp: Date.now(),
                };
                this.messages.push(userMessage);

                this.currentMessage = '';
                this.currentStreamParts = [];
                this.isStreaming = true;
                this.toolExecutions = [];

                // Persist user message to NestJS (for history)
                agentAPI.appendMessage(this.currentSession.id, 'user', message).catch(() => {});

                const targetAgentId = options?.targetAgentId ?? this.currentSession?.agentId ?? 'default';
                await socketService.sendMessage(this.currentSession.id, message, targetAgentId);
            } catch (error) {
                console.error('Failed to send message:', error);
                this.isStreaming = false;
            }

            return this.currentSession; // Return session so component can update route
        },

        handleAgentChunk(data) {
            // Safety: Ensure we have a session selected
            if (!this.currentSession) return;

            // Auto-start streaming if not active (handles multi-turn agent responses)
            if (!this.isStreaming) {
                this.isStreaming = true;
                this.currentMessage = '';
                this.currentStreamParts = [];
                this.toolExecutions = [];
            }

            const text = data.text || '';
            if (!text) return;
            this.currentMessage += text;

            const parts = this.currentStreamParts;
            const lastPart = parts[parts.length - 1];
            if (lastPart && lastPart.type === 'text') {
                this.currentStreamParts = [
                    ...parts.slice(0, -1),
                    { type: 'text', content: (lastPart.content || '') + text }
                ];
            } else {
                this.currentStreamParts = [...parts, { type: 'text', content: text }];
            }
        },

        handleToolExecution(data) {
            if (data.type === 'start') {
                // Auto-start streaming if not active
                if (!this.isStreaming) {
                    this.isStreaming = true;
                    this.currentMessage = '';
                    this.currentStreamParts = [];
                    // For tools, clear previous executions if we are starting fresh
                    this.toolExecutions = [];
                }

                // 同一 toolCallId 只添加一次，避免重复事件导致重复卡片
                if (this.toolExecutions.some(t => t.id === data.toolCallId)) return;
                const newTool = {
                    id: data.toolCallId,
                    name: data.toolName,
                    args: data.args,
                    status: 'running',
                    startTime: Date.now(),
                };
                this.toolExecutions = [...this.toolExecutions, newTool];
                this.currentStreamParts = [
                    ...this.currentStreamParts,
                    { type: 'tool', toolId: data.toolCallId }
                ];
            } else if (data.type === 'end') {
                const tool = this.toolExecutions.find(t => t.id === data.toolCallId);
                if (tool) {
                    tool.status = data.isError ? 'error' : 'completed';
                    tool.result = data.result;
                    tool.endTime = Date.now();
                    // 触发 toolExecutions 的响应式更新
                    this.toolExecutions = [...this.toolExecutions];
                }
            }
        },

        handleMessageComplete(data) {
            if (data.sessionId === this.currentSession?.id) {
                const content = this.currentMessage || data.content || '';
                if (content || this.toolExecutions.length > 0) {
                    const assistantMessage = {
                        id: Date.now().toString(),
                        role: 'assistant',
                        content,
                        timestamp: Date.now(),
                        toolCalls: [...this.toolExecutions],
                        contentParts: [...this.currentStreamParts],
                    };
                    this.messages.push(assistantMessage);
                    agentAPI.appendMessage(this.currentSession.id, 'assistant', content, {
                        toolCalls: assistantMessage.toolCalls,
                        contentParts: assistantMessage.contentParts,
                    }).catch(() => {});
                }

                this.currentMessage = '';
                this.currentStreamParts = [];
                this.isStreaming = false;
                this.toolExecutions = [];
            }
        },
    },
});
