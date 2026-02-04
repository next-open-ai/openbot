import {
    createAgentSession,
    AuthStorage,
    DefaultResourceLoader,
    ModelRegistry,
    SessionManager as CoreSessionManager
} from "@mariozechner/pi-coding-agent";
import type { AgentSession } from "@mariozechner/pi-coding-agent";
import { createBrowserTool } from "../tools/index.js";
import { buildSystemPrompt } from "../run.js";
import { loadSkillsFromPaths } from "../skills.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Session manager for gateway
 * Manages agent sessions for multiple clients
 */
class SessionManager {
    private sessions = new Map<string, AgentSession>();

    /**
     * Get or create an agent session
     */
    async getOrCreateSession(sessionId: string): Promise<AgentSession> {
        if (this.sessions.has(sessionId)) {
            return this.sessions.get(sessionId)!;
        }

        console.log(`Creating new session: ${sessionId}`);

        // Load skills from default directory
        const skillsDir = join(__dirname, "..", "..", "skills");
        const skills = loadSkillsFromPaths([skillsDir]);

        // Build system prompt
        const prompt = buildSystemPrompt(skills);

        // Setup dependencies similar to run.ts
        const authStorage = new AuthStorage();
        const modelRegistry = new ModelRegistry(authStorage);

        // Register default providers (DeepSeek, DashScope) - Logic copied from run.ts
        // DeepSeek: try specific env vars first, fallback to OPENAI_API_KEY
        const deepseekKey = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY || process.env.OPENAI_API_KEY;
        if (deepseekKey) {
            modelRegistry.registerProvider("deepseek", {
                baseUrl: "https://api.deepseek.com",
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
        }

        const dashscopeKey = process.env.DASHSCOPE_API_KEY || process.env.DASHSCOPE_KEY;
        if (dashscopeKey) {
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
        }

        // Register legacy OpenAI provider to force completions API (bypass openai-responses issues)
        const openaiKey = process.env.OPENAI_API_KEY;
        if (openaiKey) {
            modelRegistry.registerProvider("openai-legacy", {
                baseUrl: "https://api.openai.com/v1",
                authHeader: true,
                apiKey: openaiKey,
                models: [
                    {
                        id: "gpt-3.5-turbo",
                        name: "GPT-3.5 Turbo",
                        api: "openai-completions",
                        reasoning: false,
                        input: ["text"],
                        cost: { input: 0.5, output: 1.5, cacheRead: 0, cacheWrite: 0 },
                        contextWindow: 16385,
                        maxTokens: 4096,
                    },
                    {
                        id: "gpt-4o",
                        name: "GPT-4o (Legacy)",
                        api: "openai-completions",
                        reasoning: false,
                        input: ["text", "image"],
                        cost: { input: 5, output: 15, cacheRead: 0, cacheWrite: 0 },
                        contextWindow: 128000,
                        maxTokens: 4096,
                    },
                ],
            });
        }

        // Initialize loader with proper system prompt override
        const loader = new DefaultResourceLoader({
            cwd: process.cwd(),
            systemPromptOverride: (base) => {
                const parts = [base, prompt].filter(Boolean);
                return parts.join("\n\n");
            },
        });
        await loader.reload();

        // Create agent session
        const { session } = await createAgentSession({
            sessionManager: CoreSessionManager.inMemory(),
            authStorage,
            modelRegistry,
            cwd: process.cwd(),
            resourceLoader: loader,
            customTools: [createBrowserTool()],
        });

        // Set model (try to find a suitable default)
        const provider = process.env.FREEBOT_PROVIDER || "deepseek"; // Updated default
        const modelId = process.env.FREEBOT_MODEL || "deepseek-chat"; // Updated default
        const model = await modelRegistry.find(provider, modelId);
        if (model) {
            console.log(`Setting model to ${model.provider}/${model.id}`);
            await session.setModel(model).catch(err => {
                console.warn(`Failed to set model ${model.id}:`, err.message);
            });
        }

        this.sessions.set(sessionId, session);
        return session;
    }

    /**
     * Get existing session
     */
    getSession(sessionId: string): AgentSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Delete session
     */
    deleteSession(sessionId: string): boolean {
        return this.sessions.delete(sessionId);
    }

    /**
     * Get all session IDs
     */
    getAllSessionIds(): string[] {
        return Array.from(this.sessions.keys());
    }

    /**
     * Clear all sessions
     */
    clearAll(): void {
        this.sessions.clear();
    }
}

// Export singleton instance
export const sessionManager = new SessionManager();
