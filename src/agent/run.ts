import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import { getFreebotAgentDir } from "./agent-dir.js";
import type { Skill } from "./skills.js";
import { AgentManager } from "./agent-manager.js";

export interface RunOptions {
    /** 技能列表（已加载） */
    skills: Skill[];
    /** 用户提示词 */
    userPrompt: string;
    /** 是否仅打印组装后的内容，不调 LLM */
    dryRun?: boolean;
    /** API key，不传则从 pi 的 auth 或 OPENAI_API_KEY 读取 */
    apiKey?: string;
    /** 模型 ID（如 deepseek-chat、qwen-max） */
    model?: string;
    /** Provider（如 deepseek、dashscope、openai） */
    provider?: string;
    /** Agent 配置目录，默认 ~/.freebot/agent */
    agentDir?: string;
}

export interface RunResult {
    systemPrompt: string;
    userPrompt: string;
    /** 若调用了 API，则为助手回复 */
    assistantContent?: string;
    dryRun: boolean;
}

/**
 * 根据技能与提示词运行：使用 AgentManager
 */
export async function run(options: RunOptions): Promise<RunResult> {
    const {
        skills,
        userPrompt,
        dryRun: explicitDryRun,
        apiKey,
        model: modelId = "deepseek-chat",
        provider = "deepseek",
        agentDir = getFreebotAgentDir(),
    } = options;

    const manager = new AgentManager({ agentDir, skills });
    const systemPrompt = manager.buildSystemPrompt();

    // Determine dry run
    const dryRun = !!explicitDryRun; // Ensure boolean

    const result: RunResult = {
        systemPrompt,
        userPrompt,
        dryRun,
    };

    if (dryRun) {
        return result;
    }

    // Create a temporary session for this run
    const sessionId = `cli-${Date.now()}`;
    const session = await manager.getOrCreateSession(sessionId, {
        provider,
        modelId,
        apiKey,
    });

    // Collect assistant response
    let assistantContent = "";

    session.subscribe((event: AgentSessionEvent) => {
        if (event.type === "message_update") {
            const evt = event.assistantMessageEvent;
            if (evt.type === "text_delta") {
                assistantContent += evt.delta;
                process.stdout.write(evt.delta);
            } else if (evt.type === "thinking_delta") {
                process.stdout.write(evt.delta);
            }
        }
    });

    // Send prompt and wait for completion
    await session.prompt(userPrompt);

    // Clean up session
    manager.deleteSession(sessionId);

    result.assistantContent = assistantContent.trim();
    return result;
}
