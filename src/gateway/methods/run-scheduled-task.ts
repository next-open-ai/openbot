import type { IncomingMessage, ServerResponse } from "http";
import { agentManager } from "../../agent/agent-manager.js";
import { getExperienceContextForUserMessage } from "../../memory/index.js";

async function reportTokenUsage(
    backendBaseUrl: string,
    sessionId: string,
    source: "chat" | "scheduled_task",
    tokens: { promptTokens: number; completionTokens: number },
    options?: { taskId?: string; executionId?: string },
): Promise<void> {
    const url = `${backendBaseUrl.replace(/\/$/, "")}/server-api/usage`;
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

export interface RunScheduledTaskBody {
    sessionId: string;
    message: string;
    workspace: string;
    taskId?: string;
    backendBaseUrl?: string;
}

async function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        req.on("error", reject);
    });
}

/**
 * Run a scheduled task: configure workspace, send message to agent, collect response, POST back to Nest.
 * 执行完成后关闭并移除 AgentSession，避免空悬占用资源。
 */
export async function handleRunScheduledTask(
    req: IncomingMessage,
    res: ServerResponse,
): Promise<void> {
    if (req.method !== "POST") {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
        return;
    }
    let body: RunScheduledTaskBody;
    try {
        const raw = await readBody(req);
        body = JSON.parse(raw) as RunScheduledTaskBody;
    } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
        return;
    }
    const { sessionId, message, workspace, backendBaseUrl, taskId } = body;
    if (!sessionId || !message || !workspace) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "sessionId, message, workspace required" }));
        return;
    }

    try {
        const session = await agentManager.getOrCreateSession(sessionId, { workspace });
        let assistantContent = "";
        let turnPromptTokens = 0;
        let turnCompletionTokens = 0;

        const unsubscribe = session.subscribe((event: any) => {
            if (event.type === "message_update" && event.assistantMessageEvent) {
                const ev = event.assistantMessageEvent;
                if (ev.type === "text_delta" && ev.delta) {
                    assistantContent += ev.delta;
                }
            } else if (event.type === "turn_end") {
                const usage = event.message?.usage;
                if (usage) {
                    turnPromptTokens += Number(usage.input ?? usage.input_tokens ?? 0) || 0;
                    turnCompletionTokens += Number(usage.output ?? usage.output_tokens ?? 0) || 0;
                }
            }
        });

        const experienceBlock = await getExperienceContextForUserMessage();
        const userMessageToSend =
            experienceBlock.trim().length > 0
                ? `${experienceBlock}\n\n用户问题：\n${message}`
                : message;

        // 定时任务复用同一 session：若上次执行未结束会报 "Agent is already processing"。先等待空闲再发，避免并发。
        const idleTimeoutMs = 10 * 60 * 1000;
        const pollMs = 2000;
        let waited = 0;
        while ((session as any).isStreaming && waited < idleTimeoutMs) {
            await new Promise((r) => setTimeout(r, pollMs));
            waited += pollMs;
        }
        if ((session as any).isStreaming) {
            throw new Error("Session still busy after waiting; try again later.");
        }
        await session.sendUserMessage(userMessageToSend);
        unsubscribe();

        if (backendBaseUrl && assistantContent !== undefined) {
            const url = `${backendBaseUrl.replace(/\/$/, "")}/server-api/agents/sessions/${encodeURIComponent(sessionId)}/messages`;
            await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: "assistant", content: assistantContent }),
            }).catch((err) => console.error("[run-scheduled-task] POST assistant message failed:", err));
        }

        if (backendBaseUrl && (turnPromptTokens > 0 || turnCompletionTokens > 0)) {
            reportTokenUsage(backendBaseUrl, sessionId, "scheduled_task", {
                promptTokens: turnPromptTokens,
                completionTokens: turnCompletionTokens,
            }, { taskId }).catch((err) => console.error("[run-scheduled-task] reportTokenUsage failed:", err));
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, sessionId, assistantContent: assistantContent ?? "" }));
    } catch (error: any) {
        console.error("[run-scheduled-task] error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: error?.message || "Internal server error" }));
    } finally {
        // 执行完成（成功或失败）后立即关闭并移除该 AgentSession，避免空悬占用内存/连接等资源
        agentManager.deleteSession(sessionId);
    }
}
