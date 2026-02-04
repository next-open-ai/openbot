import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import {
    AuthStorage,
    createAgentSession,
    DefaultResourceLoader,
    ModelRegistry,
    SessionManager
} from "@mariozechner/pi-coding-agent";
import { join } from "node:path";
import { ensureDefaultAgentDir, getFreebotAgentDir } from "./agent-dir.js";
import type { Skill } from "./skills.js";
import { formatSkillsForPrompt } from "./skills.js";
import { createBrowserTool, closeBrowser } from "./tools/index.js";

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

/** system prompt 中每个技能描述最大字符数，超出截断以省 token */
const MAX_SKILL_DESC_IN_PROMPT = 250;

/**
 * Build system prompt with skills and browser tool description
 */
export function buildSystemPrompt(skills: Skill[]): string {
    const shortSkills = skills.map((s) => ({
        ...s,
        description:
            s.description.length <= MAX_SKILL_DESC_IN_PROMPT
                ? s.description
                : s.description.slice(0, MAX_SKILL_DESC_IN_PROMPT) + "…",
    }));
    const skillsBlock = formatSkillsForPrompt(shortSkills);

    // Add browser tool description
    const browserToolDesc = `
## Browser Tool

You have access to a \`browser\` tool for web automation:
- **navigate**: Navigate to a URL
- **snapshot**: Get page content with element refs (@e1, @e2, etc.)
- **screenshot**: Capture page image
- **click**: Click element (use selector or ref from snapshot)
- **type**: Type text into element
- **fill**: Clear and fill input field
- **scroll**: Scroll page (up/down/left/right)
- **extract**: Get text from element
- **wait**: Wait for element to appear
- **download**: Download file from URL or by clicking download button/link
- **back/forward**: Navigate browser history
- **close**: Close browser

Use refs from snapshots (e.g., @e1) for reliable element selection.
For downloads, provide either a direct URL or a selector to click.`;

    const parts = [
        "You are a helpful assistant. When users ask about skills, explain what skills are available.",
        browserToolDesc,
        skillsBlock,
    ].filter(Boolean);
    return parts.join("\n");
}

/**
 * 根据技能与提示词运行：使用 pi-coding-agent 的 createAgentSession SDK
 */
export async function run(options: RunOptions): Promise<RunResult> {
    const {
        skills,
        userPrompt,
        dryRun: explicitDryRun,
        apiKey: optKey,
        model: modelId = "deepseek-chat",
        provider = "deepseek",
        agentDir = getFreebotAgentDir(),
    } = options;

    const systemPrompt = buildSystemPrompt(skills);

    const apiKey =
        optKey ??
        (provider === "deepseek"
            ? process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY
            : provider === "dashscope"
                ? process.env.DASHSCOPE_API_KEY ?? process.env.OPENAI_API_KEY
                : process.env.OPENAI_API_KEY) ??
        "";
    const dryRun = explicitDryRun ?? !apiKey;

    const result: RunResult = {
        systemPrompt,
        userPrompt,
        dryRun,
    };

    if (dryRun) {
        return result;
    }

    ensureDefaultAgentDir(agentDir);

    // Set up credential storage and model registry
    const authPath = join(agentDir, "auth.json");
    const modelsPath = join(agentDir, "models.json");
    const authStorage = new AuthStorage(authPath);

    // Set up fallback resolver for custom provider API keys from environment
    authStorage.setFallbackResolver((provider: string) => {
        if (provider === "deepseek") {
            // DeepSeek uses OPENAI_API_KEY as per models.json configuration
            return process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
        }
        if (provider === "dashscope") {
            return process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY;
        }
        return undefined;
    });

    const modelRegistry = new ModelRegistry(authStorage, modelsPath);

    // Get API keys from environment for provider registration
    const deepseekKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || "placeholder";
    const dashscopeKey = process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY || "placeholder";

    // Register DeepSeek as a custom provider
    modelRegistry.registerProvider("deepseek", {
        baseUrl: "https://api.deepseek.com/v1",
        authHeader: true,
        apiKey: deepseekKey,
        models: [
            {
                id: "deepseek-chat",
                name: "DeepSeek Chat",
                api: "openai-completions",
                reasoning: false,
                input: ["text"],
                cost: { input: 0.14, output: 0.28, cacheRead: 0.014, cacheWrite: 0.14 },
                contextWindow: 64000,
                maxTokens: 8000,
            },
            {
                id: "deepseek-reasoner",
                name: "DeepSeek Reasoner",
                api: "openai-completions",
                reasoning: true,
                input: ["text"],
                cost: { input: 0.55, output: 2.19, cacheRead: 0.14, cacheWrite: 0.55 },
                contextWindow: 64000,
                maxTokens: 8000,
            },
        ],
    });

    // Register DashScope (Alibaba Qwen) as a custom provider
    modelRegistry.registerProvider("dashscope", {
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        authHeader: true,
        apiKey: dashscopeKey,
        models: [
            {
                id: "qwen-max",
                name: "Qwen Max",
                api: "openai-completions",
                reasoning: false,
                input: ["text", "image"],
                cost: { input: 0.04, output: 0.12, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 30000,
                maxTokens: 8000,
            },
            {
                id: "qwen-plus",
                name: "Qwen Plus",
                api: "openai-completions",
                reasoning: false,
                input: ["text", "image"],
                cost: { input: 0.008, output: 0.024, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 128000,
                maxTokens: 8000,
            },
        ],
    });


    // Set runtime API key if provided
    if (apiKey) {
        authStorage.setRuntimeApiKey(provider, apiKey);
    }

    // Create resource loader with system prompt override to add skills
    const loader = new DefaultResourceLoader({
        systemPromptOverride: (base) => {
            // Preserve base prompt (includes tool descriptions) and append skills
            const parts = [base, systemPrompt].filter(Boolean);
            return parts.join("\n\n");
        },
    });
    await loader.reload();

    // Create agent session with built-in coding tools + browser tool
    const { session } = await createAgentSession({
        sessionManager: SessionManager.inMemory(),
        authStorage,
        modelRegistry,
        cwd: process.cwd(),
        resourceLoader: loader,
        customTools: [createBrowserTool()],
    });

    // Set model if specified
    if (modelId && provider) {
        const model = modelRegistry.find(provider, modelId);
        if (!model) {
            throw new Error(
                `Model not found: provider=${provider}, modelId=${modelId}. ` +
                "Ensure agentDir has models config (default: ~/.freebot/agent/models.json) or set FREEBOT_AGENT_DIR.",
            );
        }
        await session.setModel(model);
    }

    // Collect assistant response
    let assistantContent = "";

    session.subscribe((event: AgentSessionEvent) => {
        if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
            assistantContent += event.assistantMessageEvent.delta;
            // Also write to stdout for real-time feedback
            process.stdout.write(event.assistantMessageEvent.delta);
        }
    });

    // Send prompt and wait for completion
    await session.prompt(userPrompt);

    result.assistantContent = assistantContent.trim();
    return result;
}
