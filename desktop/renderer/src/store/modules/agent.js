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
                const response = await agentAPI.createSession(options);
                const session = response.data.data;
                this.sessions.push(session);
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

                socketService.subscribeToSession(sessionId);
            } catch (error) {
                console.error('Failed to select session:', error);
                if (fallback) {
                    this.currentSession = fallback;
                    this.messages = [];
                    socketService.subscribeToSession(sessionId);
                } else {
                    throw error;
                }
            }
        },

        clearCurrentSession() {
            this.currentSession = null;
            this.messages = [];
        },

        async sendMessage(message) {
            if (!message.trim()) return;

            // Lazy Session Creation: If no current session, create one now
            if (!this.currentSession) {
                try {
                    // Title limited to 50 chars
                    const title = message.trim().substring(0, 50);
                    const session = await this.createSession({ title });

                    // Set as current session immediately so UI updates
                    this.currentSession = session;

                    // CRITICAL: Subscribe to socket for this new session to receive stream
                    socketService.subscribeToSession(session.id);

                    // We need to notify the router to update the URL (this is tricky from store, 
                    // usually better handled in component, but we can return the session to component)
                } catch (error) {
                    console.error('Failed to create lazy session:', error);
                    return;
                }
            }

            try {
                // Add user message immediately
                const userMessage = {
                    id: Date.now().toString(),
                    role: 'user',
                    content: message,
                    timestamp: Date.now(),
                };
                this.messages.push(userMessage);

                // Reset streaming state
                this.currentMessage = '';
                this.currentStreamParts = [];
                this.isStreaming = true;
                this.toolExecutions = [];

                // Send to backend
                await agentAPI.sendMessage(this.currentSession.id, message);
            } catch (error) {
                console.error('Failed to send message:', error);
                this.isStreaming = false;
            }

            return this.currentSession; // Return session so component can update route
        },

        handleAgentChunk(data) {
            // 仅在本会话流式过程中处理，避免迟到或其它会话的 chunk 被误追加
            if (!this.isStreaming || !this.currentSession) return;
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
                // Add assistant message
                const assistantMessage = {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: this.currentMessage || data.content,
                    timestamp: Date.now(),
                    toolCalls: [...this.toolExecutions],
                    contentParts: [...this.currentStreamParts] // Persist structure
                };
                this.messages.push(assistantMessage);

                // Reset state
                this.currentMessage = '';
                this.currentStreamParts = [];
                this.isStreaming = false;
                this.toolExecutions = [];
            }
        },
    },
});
