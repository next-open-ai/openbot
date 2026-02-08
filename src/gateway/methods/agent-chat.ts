import type { GatewayClient, AgentChatParams } from "../types.js";
import { agentManager } from "../../agent/agent-manager.js";
import { getExperienceContextForUserMessage } from "../../memory/index.js";
import { send, createEvent } from "../utils.js";
import { connectedClients } from "../clients.js";
import { getDesktopConfig } from "../desktop-config.js";
import { getBackendBaseUrl } from "../backend-url.js";

/**
 * Report token usage to Desktop Server (persist to DB). No-op if backend URL not set.
 */
async function reportTokenUsage(
    sessionId: string,
    source: "chat" | "scheduled_task",
    tokens: { promptTokens: number; completionTokens: number },
    options?: { taskId?: string; executionId?: string },
): Promise<void> {
    const base = getBackendBaseUrl();
    if (!base) return;
    const url = `${base.replace(/\/$/, "")}/server-api/usage`;
    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            sessionId,
            source,
            taskId: options?.taskId ?? undefined,
            executionId: options?.executionId ?? undefined,
            promptTokens: tokens.promptTokens,
            completionTokens: tokens.completionTokens,
        }),
    });
}

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
    const { message, sessionId, targetAgentId } = params;

    if (!message || !message.trim()) {
        throw new Error("Message is required");
    }

    // Use client's session ID if not provided
    const targetSessionId = sessionId || client.sessionId;
    if (!targetSessionId) {
        throw new Error("No session ID available");
    }

    console.log(`Agent chat request for session ${targetSessionId}: ${message.substring(0, 50)}...`);

    return handleAgentChatInner(client, targetSessionId, message, targetAgentId);
}

async function handleAgentChatInner(
    client: GatewayClient,
    targetSessionId: string,
    message: string,
    targetAgentId: string | undefined,
): Promise<{ status: string; sessionId: string }> {
    // 通过 sessionId 获取归属的 agentId，再通过 agentId 获取该智能体配置的 provider/model，用于创建 Agent Session
    let workspace = "default";
    let provider: string | undefined;
    let modelId: string | undefined;
    let sessionType: string | undefined;
    let sessionAgentId = "default";
    let apiKey: string | undefined;
    const base = getBackendBaseUrl();
    if (base) {
        try {
            const sessionRes = await fetch(`${base.replace(/\/$/, "")}/server-api/agents/sessions/${targetSessionId}`);
            if (sessionRes.ok) {
                const sessionData = (await sessionRes.json()) as { success?: boolean; data?: { agentId?: string; type?: string } };
                sessionType = sessionData?.data?.type;
                sessionAgentId = sessionData?.data?.agentId ?? "default";
                const agentRes = await fetch(`${base.replace(/\/$/, "")}/server-api/agent-config/${encodeURIComponent(sessionAgentId)}`);
                if (agentRes.ok) {
                    const agentData = (await agentRes.json()) as { success?: boolean; data?: { workspace?: string; provider?: string; model?: string } };
                    const agent = agentData?.data;
                    if (agent?.workspace) workspace = agent.workspace;
                    if (agent?.provider) provider = agent.provider;
                    if (agent?.model) modelId = agent.model;
                }
            }
            // 从桌面端全局配置读取当前 provider 的 API Key（设置里配置的会生效）
            const configRes = await fetch(`${base.replace(/\/$/, "")}/server-api/config`);
            if (configRes.ok) {
                const configData = (await configRes.json()) as { success?: boolean; data?: { providers?: Record<string, { apiKey?: string }> } };
                const prov = provider ?? "deepseek";
                const key = configData?.data?.providers?.[prov]?.apiKey;
                if (key && typeof key === "string" && key.trim()) apiKey = key.trim();
            }
        } catch (e) {
            console.warn("[agent-chat] Failed to fetch session/agent config, using default:", e);
        }
    }

    // system / scheduled：每次对话前先删再建，对话结束马上关闭，节省资源
    const isEphemeralSession = sessionType === "system" || sessionType === "scheduled";
    if (isEphemeralSession) {
        agentManager.deleteSession(targetSessionId);
    }

    // system 会话用请求里的 targetAgentId；chat/scheduled 用 session 对应的 agentId 传给 install_skill
    const effectiveTargetAgentId = sessionType === "system" ? targetAgentId : sessionAgentId;

    const { maxAgentSessions } = getDesktopConfig();
    let session;
    try {
        session = await agentManager.getOrCreateSession(targetSessionId, {
            workspace,
            provider,
            modelId,
            apiKey,
            maxSessions: maxAgentSessions,
            targetAgentId: effectiveTargetAgentId,
        });
    } catch (err: any) {
        const msg = err?.message ?? String(err);
        if (msg.includes("No API key") || msg.includes("API key")) {
            const prov = provider ?? "deepseek";
            throw new Error(
                `未配置 ${prov} 的 API Key。请在桌面端「设置」-「模型/API」中配置，或运行：openbot login ${prov} <你的API Key>`
            );
        }
        throw err;
    }

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
            // Record token usage for this turn (message may have usage.input / usage.output)
            const usage = (event as any).message?.usage;
            if (usage) {
                const promptTokens = Number(usage.input ?? usage.input_tokens ?? 0) || 0;
                const completionTokens = Number(usage.output ?? usage.output_tokens ?? 0) || 0;
                if (promptTokens > 0 || completionTokens > 0) {
                    reportTokenUsage(targetSessionId, "chat", { promptTokens, completionTokens }).catch((err) =>
                        console.error("[agent-chat] reportTokenUsage failed:", err)
                    );
                }
            }
        }

        if (wsMessage) {
            broadcastToSession(targetSessionId, wsMessage);
        }
        if (event.type === "turn_end" && isEphemeralSession) {
            agentManager.deleteSession(targetSessionId);
        }
    });

    try {
        const experienceBlock = await getExperienceContextForUserMessage();
        const userMessageToSend =
            experienceBlock.trim().length > 0
                ? `${experienceBlock}\n\n用户问题：\n${message}`
                : message;

        // 若 agent 正在流式输出，deliverAs: 'followUp' 将本条消息排队，避免抛出 "Agent is already processing"
        await session.sendUserMessage(userMessageToSend, { deliverAs: "followUp" });

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
