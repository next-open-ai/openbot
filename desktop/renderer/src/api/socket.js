/**
 * WebSocket service: full-duplex connection to Gateway.
 * All agent conversation (send message + receive stream) goes through this single connection.
 */

class SocketService {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
        this.currentSessionId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.pendingRequests = new Map(); // Map<id, {resolve, reject}>
    }

    /**
     * Send request and wait for response (used for connect, subscribe_session, agent.chat).
     */
    call(method, params, timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
            if (this.socket?.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket not connected'));
                return;
            }

            const id = crypto.randomUUID();
            const request = {
                type: 'request',
                id,
                method,
                params,
            };

            this.pendingRequests.set(id, { resolve, reject });

            try {
                this.socket.send(JSON.stringify(request));

                const timer = setTimeout(() => {
                    if (this.pendingRequests.has(id)) {
                        this.pendingRequests.delete(id);
                        reject(new Error('Request timeout'));
                    }
                }, timeoutMs);
                this.pendingRequests.get(id).timer = timer;
            } catch (err) {
                this.pendingRequests.delete(id);
                reject(err);
            }
        });
    }

    handleMessage(message) {
        // Response to a previous request
        if (message.type === 'response' && message.id) {
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                this.pendingRequests.delete(message.id);
                if (pending.timer) clearTimeout(pending.timer);
                if (message.error) {
                    pending.reject(new Error(message.error.message || 'Request failed'));
                } else {
                    pending.resolve(message.result);
                }
            }
            return;
        }

        // Event from Gateway (agent.chunk, agent.tool, message_complete)
        if (message.type === 'event') {
            const { event, payload } = message;
            const eventMap = {
                'agent.chunk': 'agent_chunk',
                'agent.tool': 'agent_tool',
                'message_complete': 'message_complete',
            };
            const mappedEvent = eventMap[event] || event;
            this.emit(mappedEvent, payload);
        }
    }

    /**
     * Connect to Gateway and authenticate with sessionId.
     * Call this when opening a session so subsequent agent.chat is allowed.
     */
    async connectToSession(sessionId) {
        this.currentSessionId = sessionId;
        await this.whenReady();
        if (this.socket?.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket not connected');
        }
        await this.call('connect', { sessionId });
        await this.call('subscribe_session', { sessionId });
    }

    /**
     * Send user message to agent via Gateway (full-duplex: no NestJS in path).
     * @param {string} sessionId
     * @param {string} message
     * @param {string} [targetAgentId] - 对话/安装目标：具体 agentId，或 "global"|"all" 表示全局
     */
    async sendMessage(sessionId, message, targetAgentId) {
        const params = { sessionId, message };
        if (targetAgentId !== undefined && targetAgentId !== null) {
            params.targetAgentId = targetAgentId;
        }
        return this.call('agent.chat', params, 120000);
    }

    /**
     * Abort the current agent turn for the given session.
     */
    async cancelAgent(sessionId) {
        return this.call('agent.cancel', { sessionId }, 10000);
    }

    async unsubscribeFromSession() {
        if (this.socket?.readyState === WebSocket.OPEN) {
            await this.call('unsubscribe_session');
        }
        this.currentSessionId = null;
    }

    /**
     * Resolve when WebSocket is open (for use before connectToSession / sendMessage).
     */
    whenReady() {
        if (this.socket?.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            const check = () => {
                if (this.socket?.readyState === WebSocket.OPEN) {
                    resolve();
                    return;
                }
                if (this.socket?.readyState === WebSocket.CLOSED || this.socket?.readyState === WebSocket.CLOSING) {
                    resolve(); // will reject in call() anyway
                    return;
                }
                setTimeout(check, 50);
            };
            check();
        });
    }

    connect() {
        if (this.socket?.readyState === WebSocket.OPEN) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let host = window.location.host;
        if (window.location.hostname === 'localhost' && window.location.port === '5173') {
            host = 'localhost:3000';
        }
        const url = `${protocol}//${host}`;
        console.log('Connecting to Gateway WebSocket:', url);

        try {
            this.socket = new WebSocket(url);

            this.socket.onopen = () => {
                console.log('✅ Connected to Gateway');
                this.reconnectAttempts = 0;
                if (this.currentSessionId) {
                    this.connectToSession(this.currentSessionId).catch((e) =>
                        console.warn('Re-subscribe after reconnect failed', e)
                    );
                }
            };

            this.socket.onclose = () => {
                console.log('❌ Disconnected from Gateway');
                this.scheduleReconnect();
            };

            this.socket.onerror = (err) => {
                console.error('WebSocket error:', err);
            };

            this.socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.currentSessionId = null;
        }
        this.pendingRequests.forEach((p) => {
            if (p.timer) clearTimeout(p.timer);
            p.reject(new Error('Disconnected'));
        });
        this.pendingRequests.clear();
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        return () => {
            const callbacks = this.listeners.get(event);
            if (callbacks) callbacks.delete(callback);
        };
    }

    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) callbacks.forEach((cb) => cb(data));
    }
}

export default new SocketService();
