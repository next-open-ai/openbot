import type { WebSocket } from "ws";

/**
 * Gateway client connection
 */
export interface GatewayClient {
    id: string;
    ws: WebSocket;
    authenticated: boolean;
    sessionId?: string;
    connectedAt: number;
}

/**
 * Gateway message types
 */
export type GatewayMessageType = "request" | "response" | "event";

/**
 * Base gateway message
 */
export interface GatewayMessage {
    type: GatewayMessageType;
    id?: string;
    method?: string;
    params?: any;
    result?: any;
    error?: { message: string; code?: string };
    event?: string;
    payload?: any;
}

/**
 * Request message
 */
export interface GatewayRequest extends GatewayMessage {
    type: "request";
    id: string;
    method: string;
    params?: any;
}

/**
 * Response message
 */
export interface GatewayResponse extends GatewayMessage {
    type: "response";
    id: string;
    result?: any;
    error?: { message: string; code?: string };
}

/**
 * Event message
 */
export interface GatewayEvent extends GatewayMessage {
    type: "event";
    event: string;
    payload?: any;
}

/**
 * Connect params
 */
export interface ConnectParams {
    sessionId?: string;
    nonce?: string;
}

/**
 * Agent chat params
 */
export interface AgentChatParams {
    message: string;
    sessionId?: string;
    /** 对话/安装目标：具体 agentId，或 "global"|"all" 表示全局；用于 install_skill 等隔离 */
    targetAgentId?: string;
}
