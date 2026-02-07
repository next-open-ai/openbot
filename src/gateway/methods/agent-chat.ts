import type { GatewayClient, AgentChatParams } from "../types.js";
import { agentManager } from "../../agent/agent-manager.js";
import { getExperienceContextForUserMessage } from "../../memory/index.js";
import { send, createEvent } from "../utils.js";
import { connectedClients } from "../clients.js";

/**
 * Broadcast message to all clients subscribed to a session
 */
function broadcastToSession(sessionId: string, message: any) {
    for (const client of connectedClients) {
        if (client.sessionId === sessionId) {
            send(client.ws, message);
        }
    }
}

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
        // console.log(`Agent event received: ${event.type}`); // Reduce noise

        let wsMessage: any = null;

        if (event.type === "message_update") {
            const update = event as any;
            if (update.assistantMessageEvent && update.assistantMessageEvent.type === "text_delta") {
                wsMessage = createEvent("agent.chunk", { text: update.assistantMessageEvent.delta });
            } else if (update.assistantMessageEvent && update.assistantMessageEvent.type === "thinking_delta") {
                wsMessage = createEvent("agent.chunk", { text: update.assistantMessageEvent.delta, isThinking: true });
            }
        } else if (event.type === "tool_execution_start") {
            wsMessage = createEvent("agent.tool", {
                type: "start",
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                args: event.args
            });
        } else if (event.type === "tool_execution_end") {
            wsMessage = createEvent("agent.tool", {
                type: "end",
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                result: event.result,
                isError: event.isError
            });
        } else if (event.type === "turn_end") {
            // Explicit completion event required for frontend to stop loading state
            // Only send on turn_end to avoid duplicate empty messages from message_end
            wsMessage = createEvent("message_complete", { sessionId: targetSessionId, content: "" });
        }

        if (wsMessage) {
            // Import connectedClients dynamically to avoid circular dependency issues if any,
            // or just assume it's imported at top.
            // Better to pass it or import it.
            // Let's rely on module import.
            broadcastToSession(targetSessionId, wsMessage);
        }
    });

    try {
        const experienceBlock = await getExperienceContextForUserMessage();
        const userMessageToSend =
            experienceBlock.trim().length > 0
                ? `${experienceBlock}\n\n用户问题：\n${message}`
                : message;

        await session.sendUserMessage(userMessageToSend);

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
