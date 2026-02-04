import {
    createAgentSession,
    AuthStorage,
    DefaultResourceLoader,
    ModelRegistry,
    SessionManager as CoreSessionManager
} from "@mariozechner/pi-coding-agent";
import type { AgentSession } from "@mariozechner/pi-coding-agent";
import { join } from "node:path";
import { createBrowserTool } from "../tools/index.js";
import { registerBuiltInApiProviders } from "@mariozechner/pi-ai/dist/providers/register-builtins.js";
import { getFreebotAgentDir, ensureDefaultAgentDir } from "./agent-dir.js";
import { formatSkillsForPrompt } from "./skills.js";
import type { Skill } from "./skills.js";

// Ensure all built-in providers are registered
registerBuiltInApiProviders();

export interface AgentManagerOptions {
    agentDir?: string;
    skills?: Skill[];
}

/** system prompt 中每个技能描述最大字符数，超出截断以省 token */
const MAX_SKILL_DESC_IN_PROMPT = 250;

/**
 * Unified Agent Manager for both CLI and Gateway
 */
export class AgentManager {
    private sessions = new Map<string, AgentSession>();
    private agentDir: string;
    private skills: Skill[] = [];

    constructor(options: AgentManagerOptions = {}) {
        this.agentDir = options.agentDir || getFreebotAgentDir();
        this.skills = options.skills || [];
    }

    /**
     * Build system prompt with skills and browser tool description
     */
    public buildSystemPrompt(): string {
        const shortSkills = this.skills.map((s) => ({
            ...s,
            description:
                s.description.length <= MAX_SKILL_DESC_IN_PROMPT
                    ? s.description
                    : s.description.slice(0, MAX_SKILL_DESC_IN_PROMPT) + "…",
        }));
        const skillsBlock = formatSkillsForPrompt(shortSkills);

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
     * Get or create an agent session
     */
    public async getOrCreateSession(sessionId: string, options: {
        provider?: string;
        modelId?: string;
        apiKey?: string;
    } = {}): Promise<AgentSession> {
        if (this.sessions.has(sessionId)) {
            return this.sessions.get(sessionId)!;
        }

        const {
            provider = process.env.FREEBOT_PROVIDER || "deepseek",
            modelId = process.env.FREEBOT_MODEL || "deepseek-chat",
            apiKey: optKey
        } = options;

        ensureDefaultAgentDir(this.agentDir);
        const authPath = join(this.agentDir, "auth.json");
        const modelsPath = join(this.agentDir, "models.json");
        const authStorage = new AuthStorage(authPath);

        // 1. Handle runtime API key
        if (optKey) {
            authStorage.setRuntimeApiKey(provider, optKey);
        }

        // 2. Inject API key into environment variables (WORKAROUND for pi-ai)
        if (await authStorage.hasAuth(provider)) {
            const key = await authStorage.getApiKey(provider);
            if (key) {
                if (provider === "deepseek") {
                    process.env.OPENAI_API_KEY = key;
                } else if (provider === "dashscope") {
                    process.env.DASHSCOPE_API_KEY = key;
                }
                if (!process.env.OPENAI_API_KEY) {
                    process.env.OPENAI_API_KEY = key;
                }
            }
        }

        const modelRegistry = new ModelRegistry(authStorage, modelsPath);

        // 3. Set up fallback resolver
        authStorage.setFallbackResolver((p: string) => {
            if (p === "deepseek") return process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
            if (p === "dashscope") return process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY;
            return process.env.OPENAI_API_KEY;
        });

        const systemPrompt = this.buildSystemPrompt();

        const loader = new DefaultResourceLoader({
            cwd: process.cwd(),
            systemPromptOverride: (base) => {
                const parts = [base, systemPrompt].filter(Boolean);
                console.log("--- DEBUG: SYSTEM PROMPT PARTS ---");
                parts.forEach((p, i) => console.log(`PART ${i}:\n${p}\n---`));
                return parts.join("\n\n");
            },
        });
        await loader.reload();

        console.log("--- DEBUG: FINAL RESOURCES INFO ---");
        const loadedSkills = loader.getSkills().skills;
        console.log("SDK Loaded Skills:", loadedSkills.map(s => s.name));

        const appendPrompts = loader.getAppendSystemPrompt();
        console.log("SDK Append Prompts Count:", appendPrompts.length);
        appendPrompts.forEach((p, i) => {
            console.log(`--- APPEND PART ${i} ---`);
            console.log(p);
            console.log("------------------------");
        });

        const { session } = await createAgentSession({
            sessionManager: CoreSessionManager.inMemory(),
            authStorage,
            modelRegistry,
            cwd: process.cwd(),
            resourceLoader: loader,
            customTools: [createBrowserTool()],
        });

        // 4. Set model
        const model = modelRegistry.find(provider, modelId);
        if (model) {
            console.log(`Setting model to ${model.provider}/${model.id}`);
            await session.setModel(model);
        }

        this.sessions.set(sessionId, session);
        return session;
    }

    public getSession(sessionId: string): AgentSession | undefined {
        return this.sessions.get(sessionId);
    }

    public deleteSession(sessionId: string): boolean {
        return this.sessions.delete(sessionId);
    }

    public clearAll(): void {
        this.sessions.clear();
    }
}

// Singleton for easy access (e.g., from Gateway)
export const agentManager = new AgentManager();
