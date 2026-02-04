import type { WebSocket } from "ws";
import type { GatewayClient, GatewayRequest } from "./types.js";
import { parseMessage, send, createErrorResponse, createSuccessResponse } from "./utils.js";
import { handleConnect } from "./methods/connect.js";
import { handleAgentChat } from "./methods/agent-chat.js";

/**
 * Handle incoming WebSocket message
 */
export async function handleMessage(client: GatewayClient, data: Buffer | string): Promise<void> {
    const message = parseMessage(data);

    if (!message) {
        send(client.ws, createErrorResponse("unknown", "Invalid message format"));
        return;
    }

    // Only handle request messages
    if (message.type !== "request") {
        return;
    }

    const request = message as GatewayRequest;
    const { id, method, params } = request;

    console.log(`Received request: ${method} (id: ${id})`);

    try {
        let result: any;

        switch (method) {
            case "connect":
                result = await handleConnect(client, params || {});
                break;

            case "agent.chat":
                // Check if client is authenticated
                if (!client.authenticated) {
                    throw new Error("Not authenticated. Call 'connect' first.");
                }
                result = await handleAgentChat(client, params || {});
                break;

            default:
                throw new Error(`Unknown method: ${method}`);
        }

        // Send success response
        send(client.ws, createSuccessResponse(id, result));
    } catch (error: any) {
        console.error(`Error handling ${method}:`, error);
        send(client.ws, createErrorResponse(id, error.message || "Internal error"));
    }
}
