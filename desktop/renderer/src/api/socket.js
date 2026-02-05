import { io } from 'socket.io-client';

class SocketService {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
        this.currentSessionId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.pendingRequests = new Map(); // Map<id, {resolve, reject}>
    }

    // ... (connect/etc remain same) ...
    // Note: I will need to update handleMessage to process responses too.

    handleMessage(message) {
        // Handle Responses
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
            return;
        }

        // Gateway sends: { type: 'event', event: 'name', payload: ... }
        if (message.type === 'event') {
            const { event, payload } = message;

            // Map backend events to frontend events
            // agent.chunk (backend) -> agent_chunk (frontend store expects)
            const eventMap = {
                'agent.chunk': 'agent_chunk',
                'agent.tool': 'agent_tool',
                'message_complete': 'message_complete'
            };

            const mappedEvent = eventMap[event] || event;
            this.emit(mappedEvent, payload);
        }
    }

    // ...

    /**
     * Send request and wait for response
     */
    call(method, params) {
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
                params
            };

            this.pendingRequests.set(id, { resolve, reject });

            try {
                this.socket.send(JSON.stringify(request));

                // Timeout after 10s
                setTimeout(() => {
                    if (this.pendingRequests.has(id)) {
                        this.pendingRequests.delete(id);
                        reject(new Error('Request timeout'));
                    }
                }, 10000);
            } catch (err) {
                this.pendingRequests.delete(id);
                reject(err);
            }
        });
    }

    async subscribeToSession(sessionId) {
        this.currentSessionId = sessionId;
        if (this.socket?.readyState === WebSocket.OPEN) {
            console.log(`Subscribing to session ${sessionId}`);
            await this.call('subscribe_session', { sessionId });
        }
    }

    async unsubscribeFromSession() {
        this.currentSessionId = null;
        if (this.socket?.readyState === WebSocket.OPEN) {
            console.log('Unsubscribing from session');
            await this.call('unsubscribe_session');
        }
    }

    connect() {
        if (this.socket?.readyState === WebSocket.OPEN) return;

        // Connect to Gateway (port 3000)
        // Development: ws://localhost:3000
        // Production: Window location (since served by Gateway)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let host = window.location.host;

        // In dev (vite on 5173), connect to 3000
        if (window.location.hostname === 'localhost' && window.location.port === '5173') {
            host = 'localhost:3000';
        }

        const url = `${protocol}//${host}`;
        console.log('Connecting to WebSocket:', url);

        try {
            this.socket = new WebSocket(url);

            this.socket.onopen = () => {
                console.log('✅ Connected to backend WebSocket');
                this.reconnectAttempts = 0;

                // Re-subscribe if we have an active session
                if (this.currentSessionId) {
                    this.subscribeToSession(this.currentSessionId);
                }
            };

            this.socket.onclose = () => {
                console.log('❌ Disconnected from backend WebSocket');
                this.scheduleReconnect();
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
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

    handleMessage(message) {
        // Gateway sends: { type: 'event', event: 'name', payload: ... }
        if (message.type === 'event') {
            const { event, payload } = message;

            // Map backend events to frontend events
            // agent.chunk (backend) -> agent_chunk (frontend store expects)
            const eventMap = {
                'agent.chunk': 'agent_chunk',
                'agent.tool': 'agent_tool', // Assuming backend sends agent.tool
                'message_complete': 'message_complete'
            };

            const mappedEvent = eventMap[event] || event;
            this.emit(mappedEvent, payload);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.currentSessionId = null;
        }
    }

    subscribeToSession(sessionId) {
        this.currentSessionId = sessionId;
        if (this.socket?.readyState === WebSocket.OPEN) {
            console.log(`Subscribing to session ${sessionId}`);
            this.send('subscribe_session', { sessionId });
        }
    }

    unsubscribeFromSession() {
        this.currentSessionId = null;
        if (this.socket?.readyState === WebSocket.OPEN) {
            console.log('Unsubscribing from session');
            this.send('unsubscribe_session');
        }
    }

    send(method, params) {
        if (this.socket?.readyState === WebSocket.OPEN) {
            // Gateway request format
            const request = {
                type: 'request',
                id: crypto.randomUUID(),
                method,
                params
            };
            this.socket.send(JSON.stringify(request));
        }
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // Return unsubscribe function
        return () => {
            const callbacks = this.listeners.get(event);
            if (callbacks) {
                callbacks.delete(callback);
            }
        };
    }

    emit(event, data) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }
}

export default new SocketService();
