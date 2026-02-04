import type { GatewayClient, AgentChatParams } from "../types.js";
import { agentManager } from "../../agent/agent-manager.js";
import { send, createEvent } from "../utils.js";

/**
 * Handle agent chat request with streaming support
 */
export async function handleAgentChat(
    client: GatewayClient,
    params: AgentChatParams
): Promise<{ status: string; sessionId: string }> {
    const { message, sessionId } = params;

    if (!message || !message.trim()) {
        throw new Error("Message is required");
    }

    // Use client's session ID if not provided
    const targetSessionId = sessionId || client.sessionId;
    if (!targetSessionId) {
        throw new Error("No session ID available");
    }

    console.log(`Agent chat request for session ${targetSessionId}: ${message.substring(0, 50)}...`);

    // Get or create agent session
    const session = await agentManager.getOrCreateSession(targetSessionId);

    // Set up event listener for streaming
    const unsubscribe = session.subscribe((event: any) => {
        console.log(`Agent event received: ${event.type}`);
        if (event.type === "message_update") {
            const update = event as any;
            console.log(`Message update received: ${update.assistantMessageEvent?.type}`);
            if (update.assistantMessageEvent && update.assistantMessageEvent.type === "text_delta") {
                send(client.ws, createEvent("agent.chunk", { text: update.assistantMessageEvent.delta }));
            } else if (update.assistantMessageEvent && update.assistantMessageEvent.type === "thinking_delta") {
                send(client.ws, createEvent("agent.chunk", { text: update.assistantMessageEvent.delta, isThinking: true }));
            }
        } else if (event.type === "tool_execution_start") {
            send(client.ws, createEvent("agent.tool", {
                type: "start",
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                args: event.args
            }));
        } else if (event.type === "tool_execution_end") {
            send(client.ws, createEvent("agent.tool", {
                type: "end",
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                result: event.result,
                isError: event.isError
            }));
        }
    });

    try {
        // Send user message to agent
        await session.sendUserMessage(message);

        console.log(`Agent chat completed for session ${targetSessionId}`);

        return {
            status: "completed",
            sessionId: targetSessionId,
        };
    } catch (error: any) {
        console.error(`Error in agent chat:`, error);
        throw error;
    } finally {
        unsubscribe();
    }
}
