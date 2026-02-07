import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';

/** 工作空间名仅允许英文、数字、下划线、连字符 */
const WORKSPACE_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

/** 缺省智能体 ID / 工作空间名，不可删除；对应目录 ~/.freebot/workspace/default */
export const DEFAULT_AGENT_ID = 'default';

/**
 * 智能体列表与配置使用文件存储（~/.freebot/desktop/agents.json），不使用 SQLite。
 * 会话与消息历史使用 SQLite；Skills、工作空间文档为目录文件管理。
 */
export interface AgentConfigItem {
    id: string;
    name: string;
    workspace: string;
    provider?: string;
    model?: string;
    /** 是否为系统缺省智能体（主智能体），不可删除 */
    isDefault?: boolean;
}

interface AgentsFile {
    agents: AgentConfigItem[];
}

/** 主智能体（default）的默认展示名 */
const DEFAULT_AGENT_NAME = '主智能体';

@Injectable()
export class AgentConfigService {
    private configDir: string;
    private agentsPath: string;

    constructor() {
        const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
        this.configDir = join(homeDir, '.freebot', 'desktop');
        this.agentsPath = join(this.configDir, 'agents.json');
    }

    private async ensureConfigDir(): Promise<void> {
        if (!existsSync(this.configDir)) {
            await mkdir(this.configDir, { recursive: true });
        }
    }

    private async readAgentsFile(): Promise<AgentsFile> {
        await this.ensureConfigDir();
        if (!existsSync(this.agentsPath)) {
            return { agents: [] };
        }
        const content = await readFile(this.agentsPath, 'utf-8');
        try {
            const data = JSON.parse(content);
            return Array.isArray(data.agents) ? data : { agents: [] };
        } catch {
            return { agents: [] };
        }
    }

    private async writeAgentsFile(data: AgentsFile): Promise<void> {
        await this.ensureConfigDir();
        await writeFile(this.agentsPath, JSON.stringify(data, null, 2), 'utf-8');
    }

    /** 确保 default 工作空间目录存在 */
    private async ensureDefaultWorkspace(): Promise<void> {
        const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
        const workspaceRoot = join(homeDir, '.freebot', 'workspace', DEFAULT_AGENT_ID);
        const skillsDir = join(workspaceRoot, 'skills');
        if (!existsSync(workspaceRoot)) {
            await mkdir(skillsDir, { recursive: true });
        } else if (!existsSync(skillsDir)) {
            await mkdir(skillsDir, { recursive: true });
        }
    }

    private defaultAgent(overrides?: Partial<AgentConfigItem>): AgentConfigItem {
        return {
            id: DEFAULT_AGENT_ID,
            name: DEFAULT_AGENT_NAME,
            workspace: DEFAULT_AGENT_ID,
            isDefault: true,
            ...overrides,
        };
    }

    async listAgents(): Promise<AgentConfigItem[]> {
        await this.ensureDefaultWorkspace();
        const file = await this.readAgentsFile();
        const others = file.agents.filter((a) => a.id !== DEFAULT_AGENT_ID);
        const defaultEntry = file.agents.find((a) => a.id === DEFAULT_AGENT_ID);
        const mainAgent = defaultEntry
            ? { ...defaultEntry, isDefault: true }
            : this.defaultAgent();
        return [mainAgent, ...others].map((a) => (a.id === DEFAULT_AGENT_ID ? { ...a, isDefault: true } : a));
    }

    async getAgent(id: string): Promise<AgentConfigItem | null> {
        if (id === DEFAULT_AGENT_ID) {
            await this.ensureDefaultWorkspace();
        }
        const file = await this.readAgentsFile();
        const found = file.agents.find((a) => a.id === id);
        if (found) return { ...found, isDefault: found.id === DEFAULT_AGENT_ID };
        if (id === DEFAULT_AGENT_ID) return this.defaultAgent();
        return null;
    }

    async createAgent(params: { name: string; workspace: string }): Promise<AgentConfigItem> {
        const { name, workspace } = params;
        if (workspace === DEFAULT_AGENT_ID) {
            throw new BadRequestException('工作空间名 default 为系统保留（主智能体），请使用其他名称');
        }
        if (!workspace || !WORKSPACE_NAME_REGEX.test(workspace)) {
            throw new BadRequestException('工作空间名必须为英文、数字、下划线或连字符');
        }
        const trimmedName = (name || workspace).trim() || workspace;

        const file = await this.readAgentsFile();
        if (file.agents.some((a) => a.workspace === workspace || a.id === workspace)) {
            throw new ConflictException('该工作空间名已存在');
        }

        const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
        const workspaceRoot = join(homeDir, '.freebot', 'workspace', workspace);
        const skillsDir = join(workspaceRoot, 'skills');
        if (!existsSync(workspaceRoot)) {
            await mkdir(skillsDir, { recursive: true });
        } else if (!existsSync(skillsDir)) {
            await mkdir(skillsDir, { recursive: true });
        }

        const agent: AgentConfigItem = {
            id: workspace,
            name: trimmedName,
            workspace,
            provider: undefined,
            model: undefined,
        };
        file.agents.push(agent);
        await this.writeAgentsFile(file);
        return agent;
    }

    async updateAgent(id: string, updates: Partial<Pick<AgentConfigItem, 'name' | 'provider' | 'model'>>): Promise<AgentConfigItem> {
        if (id === DEFAULT_AGENT_ID) {
            await this.ensureDefaultWorkspace();
        }
        const file = await this.readAgentsFile();
        let idx = file.agents.findIndex((a) => a.id === id);
        if (idx < 0) {
            if (id === DEFAULT_AGENT_ID) {
                file.agents.unshift(this.defaultAgent());
                idx = 0;
            } else {
                throw new NotFoundException('智能体不存在');
            }
        }
        const agent = file.agents[idx];
        if (agent.id !== DEFAULT_AGENT_ID && updates.name !== undefined) {
            agent.name = (updates.name || agent.workspace).trim() || agent.workspace;
        }
        if (updates.provider !== undefined) agent.provider = updates.provider;
        if (updates.model !== undefined) agent.model = updates.model;
        await this.writeAgentsFile(file);
        return { ...agent, isDefault: agent.id === DEFAULT_AGENT_ID };
    }

    async deleteAgent(id: string): Promise<void> {
        if (id === DEFAULT_AGENT_ID) {
            throw new BadRequestException('主智能体（default）不可删除');
        }
        const file = await this.readAgentsFile();
        const idx = file.agents.findIndex((a) => a.id === id);
        if (idx < 0) {
            throw new NotFoundException('智能体不存在');
        }
        file.agents.splice(idx, 1);
        await this.writeAgentsFile(file);
    }
}
