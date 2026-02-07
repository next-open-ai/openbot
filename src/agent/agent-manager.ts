import {
    createAgentSession,
    AuthStorage,
    DefaultResourceLoader,
    ModelRegistry,
    SessionManager as CoreSessionManager,
    createReadTool,
    createWriteTool,
    createEditTool,
    createBashTool,
    createFindTool,
    createGrepTool,
    createLsTool
} from "@mariozechner/pi-coding-agent";
import type { AgentSession } from "@mariozechner/pi-coding-agent";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { createCompactionMemoryExtensionFactory } from "../memory/compaction-extension.js";
import { getCompactionContextForSystemPrompt } from "../memory/index.js";
import { createBrowserTool, createSaveExperienceTool } from "../tools/index.js";
import { registerBuiltInApiProviders } from "@mariozechner/pi-ai/dist/providers/register-builtins.js";
import { getFreebotAgentDir, getFreebotWorkspaceDir, ensureDefaultAgentDir } from "./agent-dir.js";
import { formatSkillsForPrompt } from "./skills.js";
import type { Skill } from "./skills.js";

// Ensure all built-in providers are registered
registerBuiltInApiProviders();

export interface AgentManagerOptions {
    agentDir?: string;
    workspace?: string; // Workspace name (e.g. "default", "my-project")
    skillPaths?: string[]; // Additional skill paths from CLI/Config
    skills?: Skill[]; // Pre-loaded skills (optional)
}

/** system prompt 中每个技能描述最大字符数，超出截断以省 token */
const MAX_SKILL_DESC_IN_PROMPT = 250;

/**
 * Unified Agent Manager for both CLI and Gateway
 */
export class AgentManager {
    private sessions = new Map<string, AgentSession>();
    private agentDir: string;
    private workspaceDir: string;
    private skillPaths: string[] = [];
    private preLoadedSkills: Skill[] = [];

    constructor(options: AgentManagerOptions = {}) {
        this.agentDir = options.agentDir || getFreebotAgentDir();

        // Centralized workspace root: ~/.freebot/workspace/
        const workspaceRoot = getFreebotWorkspaceDir();
        const workspaceName = options.workspace || "default";
        this.workspaceDir = join(workspaceRoot, workspaceName);

        this.skillPaths = options.skillPaths || [];
        this.preLoadedSkills = options.skills || [];

        // Ensure workspace directory exists
        if (!existsSync(this.workspaceDir)) {
            mkdirSync(this.workspaceDir, { recursive: true });
        }
    }

    /**
     * Re-configure the manager
     */
    public configure(options: AgentManagerOptions): void {
        if (options.agentDir) this.agentDir = options.agentDir;
        if (options.workspace) {
            const workspaceRoot = getFreebotWorkspaceDir();
            this.workspaceDir = join(workspaceRoot, options.workspace);
            if (!existsSync(this.workspaceDir)) {
                mkdirSync(this.workspaceDir, { recursive: true });
            }
        }
        if (options.skillPaths) this.skillPaths = options.skillPaths;
        if (options.skills) this.preLoadedSkills = options.skills;
    }

    /**
     * Build system prompt with skills and browser tool description
     */
    public buildSystemPrompt(skills: Skill[]): string {
        const shortSkills = skills.map((s) => ({
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
        return parts.join("\n\n");
    }

    /**
     * Get the initial context (prompt and skills)
     */
    public async getContext(): Promise<{ systemPrompt: string; skills: Skill[] }> {
        const loader = this.createResourceLoader();
        await loader.reload();
        const loadedSkills = loader.getSkills().skills;
        const systemPrompt = this.buildSystemPrompt(loadedSkills);
        return { systemPrompt, skills: loadedSkills };
    }

    private createResourceLoader(sessionId?: string, compactionBlock?: string): DefaultResourceLoader {
        const loader = new DefaultResourceLoader({
            cwd: this.workspaceDir,
            agentDir: this.agentDir,
            noSkills: true, // Disable SDK's built-in skills logic to take full control
            additionalSkillPaths: this.resolveSkillPaths(),
            extensionFactories: sessionId ? [createCompactionMemoryExtensionFactory(sessionId)] : [],
            systemPromptOverride: (base) => {
                const loadedSkills = loader.getSkills().skills;
                let customPrompt = this.buildSystemPrompt(loadedSkills);
                if (compactionBlock?.trim()) {
                    customPrompt = customPrompt + "\n\n" + compactionBlock.trim();
                }
                return customPrompt;
            },
        });
        return loader;
    }

    /**
     * Resolve all relevant skill paths (Global, Project, Workspace)
     */
    private resolveSkillPaths(): string[] {
        const paths = new Set<string>();

        // 1. Managed skills (Global: ~/.freebot/agent/skills)
        const managedSkillsDir = join(this.agentDir, "skills");
        if (existsSync(managedSkillsDir)) paths.add(managedSkillsDir);

        // 2. Extra paths (CLI -s / Config)
        this.skillPaths.forEach(p => paths.add(p));

        // 3. Project skills (./skills)
        const projectSkillsDir = join(process.cwd(), "skills");
        if (existsSync(projectSkillsDir)) paths.add(projectSkillsDir);

        // 4. Workspace skills (./workspace/<name>/skills)
        const workspaceSkillsDir = join(this.workspaceDir, "skills");
        if (existsSync(workspaceSkillsDir)) paths.add(workspaceSkillsDir);

        return Array.from(paths);
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

        const systemPrompt = this.buildSystemPrompt(this.preLoadedSkills);

        const compactionBlock = await getCompactionContextForSystemPrompt(sessionId);
        const loader = this.createResourceLoader(sessionId, compactionBlock);
        await loader.reload();

        const coreTools: Record<string, any> = {
            read: createReadTool(this.workspaceDir),
            write: createWriteTool(this.workspaceDir),
            edit: createEditTool(this.workspaceDir),
            bash: createBashTool(this.workspaceDir),
            find: createFindTool(this.workspaceDir),
            grep: createGrepTool(this.workspaceDir),
            ls: createLsTool(this.workspaceDir),
        };

        const { session } = await createAgentSession({
            agentDir: this.agentDir,
            sessionManager: CoreSessionManager.inMemory(),
            authStorage,
            modelRegistry,
            cwd: this.workspaceDir,
            resourceLoader: loader,
            customTools: [
                createBrowserTool(this.workspaceDir),
                createSaveExperienceTool(sessionId),
            ],
            // @ts-ignore - Strictly scope tools to the workspace
            baseToolsOverride: coreTools,
        } as any);

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
