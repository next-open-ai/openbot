import { io } from 'socket.io-client';

class SocketService {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
        this.currentSessionId = null;
    }

    connect() {
        if (this.socket?.connected) return;

        this.socket = io('http://localhost:3001', {
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
        });

        this.socket.on('connect', () => {
            console.log('✅ Connected to backend WebSocket');
            // Re-subscribe if we have an active session
            if (this.currentSessionId) {
                console.log(`Resubscribing to session ${this.currentSessionId} after reconnect`);
                this.socket.emit('subscribe_session', { sessionId: this.currentSessionId });
            }
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from backend WebSocket');
        });

        this.socket.on('agent_chunk', (data) => {
            this.emit('agent_chunk', data);
        });

        this.socket.on('agent_tool', (data) => {
            this.emit('agent_tool', data);
        });

        this.socket.on('message_complete', (data) => {
            this.emit('message_complete', data);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.currentSessionId = null;
        }
    }

    subscribeToSession(sessionId) {
        this.currentSessionId = sessionId;
        if (this.socket) {
            console.log(`Subscribing to session ${sessionId}`);
            this.socket.emit('subscribe_session', { sessionId });
        }
    }

    unsubscribeFromSession() {
        this.currentSessionId = null;
        if (this.socket) {
            console.log('Unsubscribing from session');
            this.socket.emit('unsubscribe_session');
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
