/**
 * 从桌面端配置目录（~/.openbot/desktop）读取 config.json 与 agents.json，
 * 供 CLI / Gateway 等与桌面设置一致的 provider、model、apiKey。
 */
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { homedir } from "os";

function getDesktopDir(): string {
    const home = process.env.HOME || process.env.USERPROFILE || homedir();
    return join(home, ".openbot", "desktop");
}

/** 与 Nest ConfigService 使用的 config.json 结构一致 */
interface DesktopConfig {
    defaultProvider?: string;
    defaultModel?: string;
    /** 缺省智能体 id；未设置或未找到时使用 default */
    defaultAgentId?: string;
    providers?: Record<string, { apiKey?: string; baseUrl?: string }>;
}

interface AgentItem {
    id: string;
    workspace: string;
    provider?: string;
    model?: string;
}

interface AgentsFile {
    agents?: AgentItem[];
}

export interface DesktopAgentConfig {
    provider: string;
    model: string;
    apiKey?: string;
}

const DEFAULT_AGENT_ID = "default";

/**
 * 从 config.json 读取缺省智能体 id（defaultAgentId）。
 * 若未配置、或该 id 在 agents.json 中不存在，则返回 default，即使用主智能体配置创建 session。
 */
export async function getBoundAgentIdForCli(): Promise<string> {
    const desktopDir = getDesktopDir();
    const configPath = join(desktopDir, "config.json");
    const agentsPath = join(desktopDir, "agents.json");

    let boundId: string = DEFAULT_AGENT_ID;
    if (existsSync(configPath)) {
        try {
            const raw = await readFile(configPath, "utf-8");
            const config = JSON.parse(raw) as DesktopConfig;
            const id = config.defaultAgentId ? String(config.defaultAgentId).trim() : "";
            if (id) boundId = id;
        } catch {
            // ignore, use default
        }
    }

    if (boundId === DEFAULT_AGENT_ID) return DEFAULT_AGENT_ID;
    if (!existsSync(agentsPath)) return DEFAULT_AGENT_ID;
    try {
        const raw = await readFile(agentsPath, "utf-8");
        const data = JSON.parse(raw) as AgentsFile;
        const agents = Array.isArray(data.agents) ? data.agents : [];
        const found = agents.some((a) => a.id === boundId);
        return found ? boundId : DEFAULT_AGENT_ID;
    } catch {
        return DEFAULT_AGENT_ID;
    }
}

/**
 * 根据 workspace（agent id）从桌面配置中读取该 agent 的 provider、model 及 API Key。
 * 若文件不存在或解析失败返回 null，调用方使用环境变量或默认值。
 */
export async function loadDesktopAgentConfig(workspace: string): Promise<DesktopAgentConfig | null> {
    const desktopDir = getDesktopDir();
    const configPath = join(desktopDir, "config.json");
    const agentsPath = join(desktopDir, "agents.json");

    let config: DesktopConfig = {};
    if (existsSync(configPath)) {
        try {
            const raw = await readFile(configPath, "utf-8");
            config = JSON.parse(raw) as DesktopConfig;
        } catch {
            return null;
        }
    }

    const agentId = workspace === "default" ? "default" : workspace;
    let provider = config.defaultProvider ?? "deepseek";
    let model = config.defaultModel ?? "deepseek-chat";

    if (existsSync(agentsPath)) {
        try {
            const raw = await readFile(agentsPath, "utf-8");
            const data = JSON.parse(raw) as AgentsFile;
            const agents = Array.isArray(data.agents) ? data.agents : [];
            const agent = agents.find((a) => a.id === agentId);
            if (agent?.provider) provider = agent.provider;
            if (agent?.model) model = agent.model;
        } catch {
            // ignore
        }
    }

    const provConfig = config.providers?.[provider];
    const apiKey = provConfig?.apiKey && typeof provConfig.apiKey === "string" && provConfig.apiKey.trim()
        ? provConfig.apiKey.trim()
        : undefined;

    return { provider, model, apiKey: apiKey ?? undefined };
}
