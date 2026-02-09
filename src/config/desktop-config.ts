/**
 * 桌面端配置单一入口（~/.openbot/desktop）。
 * 供 CLI、WebSocket Gateway 等读取与写入，与 Nest Desktop Backend 使用的 config.json / agents.json 一致。
 * provider-support.json 提供流行 provider 及模型目录，供配置时下拉备选；配置完成后可同步到 agent 目录 models.json 供 pi 使用。
 */
import { readFile, writeFile } from "fs/promises";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { getOpenbotAgentDir } from "../agent/agent-dir.js";
import {
    DEFAULT_PROVIDER_SUPPORT,
    type ProviderSupport,
    type ProviderSupportEntry,
    type ProviderSupportModel,
    type ModelSupportType,
} from "./provider-support-default.js";

export type { ProviderSupport, ProviderSupportEntry, ProviderSupportModel, ModelSupportType };

function getDesktopDir(): string {
    const home = process.env.HOME || process.env.USERPROFILE || homedir();
    return join(home, ".openbot", "desktop");
}

/** 已配置模型项（与 Nest ConfiguredModelItem 一致），用于读取 config 并写入 models.json */
interface DesktopConfiguredModel {
    provider: string;
    modelId: string;
    type: string;
    alias?: string;
    reasoning?: boolean;
    cost?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number };
    contextWindow?: number;
    maxTokens?: number;
}

/** RAG 长记忆：使用远端 embedding 模型；未配置时基于 RAG 的长记忆空转 */
export interface RagEmbeddingConfig {
    provider: string;
    modelId: string;
    apiKey?: string;
    baseUrl?: string;
}

/** 与 Nest ConfigService 使用的 config.json 结构一致 */
interface DesktopConfigJson {
    defaultProvider?: string;
    defaultModel?: string;
    defaultAgentId?: string;
    maxAgentSessions?: number;
    providers?: Record<string, { apiKey?: string; baseUrl?: string; alias?: string }>;
    configuredModels?: DesktopConfiguredModel[];
    /** RAG 知识库：embedding 使用该 provider+model，未配置时长记忆空转 */
    rag?: { embeddingProvider?: string; embeddingModel?: string };
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

const DEFAULT_AGENT_ID = "default";
const DEFAULT_MAX_AGENT_SESSIONS = 5;

/** 同步读取桌面全局配置（Gateway 等需要同步读的场景） */
function getConfigPath(): string {
    return join(getDesktopDir(), "config.json");
}

const PROVIDER_SUPPORT_FILENAME = "provider-support.json";

function getProviderSupportPath(): string {
    return join(getDesktopDir(), PROVIDER_SUPPORT_FILENAME);
}

/**
 * 同步读取桌面全局配置中的 maxAgentSessions 等。
 * Gateway 进程内使用，用于会话上限等。
 */
export function getDesktopConfig(): { maxAgentSessions: number } {
    try {
        const configPath = getConfigPath();
        if (!existsSync(configPath)) {
            return { maxAgentSessions: DEFAULT_MAX_AGENT_SESSIONS };
        }
        const content = readFileSync(configPath, "utf-8");
        const data = JSON.parse(content) as DesktopConfigJson;
        const max = data.maxAgentSessions;
        const maxAgentSessions =
            typeof max === "number" && max > 0 ? Math.floor(max) : DEFAULT_MAX_AGENT_SESSIONS;
        return { maxAgentSessions };
    } catch {
        return { maxAgentSessions: DEFAULT_MAX_AGENT_SESSIONS };
    }
}

/** 同步读取 RAG embedding 配置；未配置或无效时返回 null，长记忆将空转 */
export function getRagEmbeddingConfigSync(): RagEmbeddingConfig | null {
    try {
        const configPath = getConfigPath();
        if (!existsSync(configPath)) return null;
        const content = readFileSync(configPath, "utf-8");
        const data = JSON.parse(content) as DesktopConfigJson;
        const provider = data.rag?.embeddingProvider?.trim();
        const modelId = data.rag?.embeddingModel?.trim();
        if (!provider || !modelId) return null;
        const prov = data.providers?.[provider];
        const apiKey = prov?.apiKey?.trim();
        if (!apiKey) return null;
        let baseUrl = prov?.baseUrl?.trim();
        if (!baseUrl) {
            const d = EMBEDDING_DEFAULT_BASE_URL[provider];
            baseUrl = d ?? "";
        }
        if (!baseUrl) return null;
        return { provider, modelId, apiKey, baseUrl: baseUrl.replace(/\/$/, "") };
    } catch {
        return null;
    }
}

const EMBEDDING_DEFAULT_BASE_URL: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    "openai-custom": "",
    deepseek: "https://api.deepseek.com/v1",
    dashscope: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    nvidia: "https://integrate.api.nvidia.com/v1",
    kimi: "https://api.moonshot.cn/v1",
};

export interface DesktopAgentConfig {
    provider: string;
    model: string;
    apiKey?: string;
    /** 工作区名，来自 agents.json 的 agent.workspace 或 agent.id */
    workspace?: string;
}

/**
 * 从 config.json 读取缺省智能体 id（defaultAgentId）。
 * 若未配置、或该 id 在 agents.json 中不存在，则返回 default。
 */
export async function getBoundAgentIdForCli(): Promise<string> {
    const desktopDir = getDesktopDir();
    const configPath = join(desktopDir, "config.json");
    const agentsPath = join(desktopDir, "agents.json");

    let boundId: string = DEFAULT_AGENT_ID;
    if (existsSync(configPath)) {
        try {
            const raw = await readFile(configPath, "utf-8");
            const config = JSON.parse(raw) as DesktopConfigJson;
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
 * 根据 agentId 从桌面配置中读取该 agent 的 provider、model 及 API Key。
 * 若文件不存在或解析失败返回 null，调用方使用环境变量或默认值。
 */
export async function loadDesktopAgentConfig(agentId: string): Promise<DesktopAgentConfig | null> {
    const desktopDir = getDesktopDir();
    const configPath = join(desktopDir, "config.json");
    const agentsPath = join(desktopDir, "agents.json");

    let config: DesktopConfigJson = {};
    if (existsSync(configPath)) {
        try {
            const raw = await readFile(configPath, "utf-8");
            config = JSON.parse(raw) as DesktopConfigJson;
        } catch {
            return null;
        }
    }

    const resolvedAgentId = agentId === "default" ? "default" : agentId;
    let provider = config.defaultProvider ?? "deepseek";
    let model = config.defaultModel ?? "deepseek-chat";
    let workspaceName: string = resolvedAgentId;

    if (existsSync(agentsPath)) {
        try {
            const raw = await readFile(agentsPath, "utf-8");
            const data = JSON.parse(raw) as AgentsFile;
            const agents = Array.isArray(data.agents) ? data.agents : [];
            const agent = agents.find((a) => a.id === resolvedAgentId);
            if (agent) {
                if (agent.workspace) workspaceName = agent.workspace;
                else if (agent.id) workspaceName = agent.id;
                if (agent.provider) provider = agent.provider;
                if (agent.model) model = agent.model;
            }
        } catch {
            // ignore
        }
    }

    const provConfig = config.providers?.[provider];
    const apiKey =
        provConfig?.apiKey && typeof provConfig.apiKey === "string" && provConfig.apiKey.trim()
            ? provConfig.apiKey.trim()
            : undefined;

    return { provider, model, apiKey: apiKey ?? undefined, workspace: workspaceName };
}

/** 供 CLI config list 使用：从桌面 config 读出的配置列表项 */
export interface DesktopConfigListEntry {
    provider: string;
    defaultModel: string;
    hasKey: boolean;
}

/** 供 CLI config list 使用：桌面配置列表（中心化配置源） */
export interface DesktopConfigList {
    defaultProvider: string;
    defaultModel: string;
    providers: DesktopConfigListEntry[];
}

function ensureDesktopDir(): string {
    const desktopDir = getDesktopDir();
    if (!existsSync(desktopDir)) {
        mkdirSync(desktopDir, { recursive: true });
    }
    return desktopDir;
}

async function readDesktopConfigJson(): Promise<DesktopConfigJson> {
    const configPath = getConfigPath();
    if (!existsSync(configPath)) return {};
    try {
        const raw = await readFile(configPath, "utf-8");
        return JSON.parse(raw) as DesktopConfigJson;
    } catch {
        return {};
    }
}

async function writeDesktopConfigJson(config: DesktopConfigJson): Promise<void> {
    ensureDesktopDir();
    const configPath = getConfigPath();
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * 将某 provider 的 API Key 写入桌面 config（中心化配置源）。
 * openbot login 使用此方法，不再写 agent 目录 auth.json。
 */
export async function setProviderApiKey(provider: string, apiKey: string): Promise<void> {
    const config = await readDesktopConfigJson();
    if (!config.providers) config.providers = {};
    if (!config.providers[provider]) config.providers[provider] = {};
    config.providers[provider].apiKey = apiKey.trim();
    await writeDesktopConfigJson(config);
    await syncDesktopConfigToModelsJson();
}

/**
 * 将全局默认 provider/model 写入桌面 config。
 * openbot config set-model 使用此方法，不再写 agent 目录 models.json。
 */
export async function setDefaultModel(provider: string, modelId: string): Promise<void> {
    const config = await readDesktopConfigJson();
    config.defaultProvider = provider;
    config.defaultModel = modelId.trim();
    await writeDesktopConfigJson(config);
    await syncDesktopConfigToModelsJson();
}

/**
 * 供 CLI config list 使用，从桌面 config 读出配置列表。
 */
export async function getDesktopConfigList(): Promise<DesktopConfigList> {
    const config = await readDesktopConfigJson();
    const defaultProvider = config.defaultProvider ?? "deepseek";
    const defaultModel = config.defaultModel ?? "deepseek-chat";
    const providers = config.providers ?? {};
    const entries: DesktopConfigListEntry[] = Object.entries(providers).map(([name, p]) => ({
        provider: name,
        defaultModel: name === defaultProvider ? defaultModel : "—",
        hasKey: !!(p?.apiKey && String(p.apiKey).trim()),
    }));
    if (entries.length === 0) {
        entries.push({
            provider: defaultProvider,
            defaultModel,
            hasKey: false,
        });
    }
    return { defaultProvider, defaultModel, providers: entries };
}

/**
 * 确保桌面目录下存在 provider-support.json（不存在则写入默认内容）。
 * 供配置供应商时作备选下拉列表项。
 */
export async function ensureProviderSupportFile(): Promise<void> {
    const path = getProviderSupportPath();
    if (existsSync(path)) return;
    ensureDesktopDir();
    await writeFile(path, JSON.stringify(DEFAULT_PROVIDER_SUPPORT, null, 2), "utf-8");
}

/**
 * 读取桌面 provider-support.json（流行 provider 及模型目录）。
 * 若文件不存在则先写入默认内容再返回；若存在则与默认合并，补全默认中已有而文件中缺失的 provider（如新增的 openai-custom）。
 */
export async function getProviderSupport(): Promise<ProviderSupport> {
    await ensureProviderSupportFile();
    const path = getProviderSupportPath();
    try {
        const raw = await readFile(path, "utf-8");
        const fromFile = JSON.parse(raw) as ProviderSupport;
        const merged = { ...fromFile };
        let hasNew = false;
        for (const [id, entry] of Object.entries(DEFAULT_PROVIDER_SUPPORT)) {
            if (!(id in merged)) {
                merged[id] = entry;
                hasNew = true;
            }
        }
        if (hasNew) {
            await writeFile(path, JSON.stringify(merged, null, 2), "utf-8");
        }
        return merged;
    } catch {
        return DEFAULT_PROVIDER_SUPPORT;
    }
}

/** Pi ModelRegistry / models.json 中单个 model 的格式（含 reasoning、cost 等） */
interface PiModelEntry {
    id: string;
    name: string;
    reasoning: boolean;
    input: string[];
    cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
    contextWindow: number;
    maxTokens: number;
    supportsTools?: boolean;
}

/** Pi ModelRegistry 使用的 models.json 中单个 provider 的格式 */
interface PiProviderEntry {
    name: string;
    apiKey: string;
    api: string;
    baseUrl: string;
    authHeader?: boolean;
    models: PiModelEntry[];
}

/** 同步到 pi models.json 时使用的默认 baseUrl / apiKey 环境变量名 / api，provider-support 中不再存储 */
const SYNC_DEFAULTS: Record<string, { baseUrl: string; apiKey: string; api: string }> = {
    deepseek: { baseUrl: "https://api.deepseek.com", apiKey: "OPENAI_API_KEY", api: "openai-completions" },
    dashscope: { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", apiKey: "DASHSCOPE_API_KEY", api: "openai-completions" },
    openai: { baseUrl: "https://api.openai.com/v1", apiKey: "OPENAI_API_KEY", api: "openai-completions" },
    /** 自定义端点，baseUrl 由用户填写，兼容所有 OpenAI 接口 */
    "openai-custom": { baseUrl: "", apiKey: "OPENAI_API_KEY", api: "openai-completions" },
    nvidia: { baseUrl: "https://integrate.api.nvidia.com/v1", apiKey: "NVIDIA_API_KEY", api: "openai-completions" },
    kimi: { baseUrl: "https://api.moonshot.cn/v1", apiKey: "MOONSHOT_API_KEY", api: "openai-completions" },
};

const DEFAULT_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
const DEFAULT_CONTEXT_WINDOW = 64000;
const DEFAULT_MAX_TOKENS = 8192;

function configuredModelToPi(item: DesktopConfiguredModel, displayName: string): PiModelEntry {
    const cost = item.cost ?? {};
    return {
        id: item.modelId,
        name: displayName,
        reasoning: item.reasoning ?? false,
        input: ["text"],
        cost: {
            input: cost.input ?? 0,
            output: cost.output ?? 0,
            cacheRead: cost.cacheRead ?? 0,
            cacheWrite: cost.cacheWrite ?? 0,
        },
        contextWindow: item.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
        maxTokens: item.maxTokens ?? DEFAULT_MAX_TOKENS,
        supportsTools: true,
    };
}

/**
 * 根据桌面 config（已配置的 providers + configuredModels）与 provider-support，生成并写入 agent 目录的 models.json。
 * 仅包含在 config 的 providers 中已配置的 provider；每个 provider 的 models 来自 configuredModels，结构含 reasoning、cost 等。
 */
export async function syncDesktopConfigToModelsJson(): Promise<void> {
    const config = await readDesktopConfigJson();
    const configured = config.providers ?? {};
    const configuredModels = Array.isArray(config.configuredModels) ? config.configuredModels : [];
    if (Object.keys(configured).length === 0) {
        return;
    }
    const support = await getProviderSupport();
    const piProviders: Record<string, PiProviderEntry> = {};
    for (const [providerId, userConfig] of Object.entries(configured)) {
        if (!userConfig?.apiKey?.trim()) continue;
        const defaults = SYNC_DEFAULTS[providerId] ?? { baseUrl: "", apiKey: "OPENAI_API_KEY", api: "openai-completions" };
        const baseUrl = userConfig.baseUrl?.trim() || defaults.baseUrl;
        if (!baseUrl) continue;
        const def = support[providerId];
        const items = configuredModels.filter((m) => m.provider === providerId);
        let models: PiModelEntry[];
        if (items.length > 0) {
            models = items.map((item) => {
                const displayName =
                    (item.alias && item.alias.trim()) ||
                    (def?.models?.find((m) => m.id === item.modelId)?.name) ||
                    item.modelId;
                return configuredModelToPi(item, displayName);
            });
        } else if (def?.models?.length) {
            models = def.models.map((m) =>
                configuredModelToPi(
                    {
                        provider: providerId,
                        modelId: m.id,
                        type: "llm",
                        alias: m.name,
                        reasoning: false,
                        cost: DEFAULT_COST,
                        contextWindow: DEFAULT_CONTEXT_WINDOW,
                        maxTokens: DEFAULT_MAX_TOKENS,
                    },
                    m.name || m.id,
                ),
            );
        } else {
            continue;
        }
        piProviders[providerId] = {
            name: (userConfig.alias?.trim() || def?.name) || providerId,
            apiKey: defaults.apiKey,
            api: defaults.api,
            baseUrl: baseUrl.replace(/\/$/, ""),
            authHeader: true,
            models,
        };
    }
    if (Object.keys(piProviders).length === 0) return;
    const agentDir = getOpenbotAgentDir();
    if (!existsSync(agentDir)) {
        mkdirSync(agentDir, { recursive: true });
    }
    const modelsPath = join(agentDir, "models.json");
    await writeFile(modelsPath, JSON.stringify({ providers: piProviders }, null, 2), "utf-8");
}
