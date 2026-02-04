import type { GatewayClient, ConnectParams } from "../types.js";
import { randomUUID } from "crypto";

/**
 * Handle client connection request
 */
export async function handleConnect(
    client: GatewayClient,
    params: ConnectParams
): Promise<{ sessionId: string; status: string }> {
    // Mark client as authenticated
    client.authenticated = true;

    // Use provided session ID or generate new one
    client.sessionId = params.sessionId || randomUUID();

    console.log(`Client ${client.id} connected with session ${client.sessionId}`);

    return {
        sessionId: client.sessionId,
        status: "connected",
    };
}
