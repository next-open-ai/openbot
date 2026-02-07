import { Injectable } from '@nestjs/common';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export interface AppConfig {
    gatewayUrl: string;
    defaultProvider: string;
    defaultModel: string;
    defaultWorkspace: string;
    theme: 'light' | 'dark';
    /** 同时存在的聊天 AgentSession 上限，超过时淘汰最久未用的 */
    maxAgentSessions?: number;
    /** 登录用户名，未配置时使用缺省（与缺省密码 123456 搭配） */
    loginUsername?: string;
    /** 登录密码，未配置时使用缺省 123456 */
    loginPassword?: string;
    providers: {
        [key: string]: {
            apiKey?: string;
            baseUrl?: string;
        };
    };
}

@Injectable()
export class ConfigService {
    private configPath: string;
    private config: AppConfig;

    constructor() {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        const configDir = join(homeDir, '.freebot', 'desktop');
        this.configPath = join(configDir, 'config.json');

        // Ensure config directory exists
        if (!existsSync(configDir)) {
            mkdir(configDir, { recursive: true });
        }

        this.config = this.getDefaultConfig();
        this.loadConfig();
    }

    private getDefaultConfig(): AppConfig {
        return {
            gatewayUrl: 'ws://localhost:3000',
            defaultProvider: 'deepseek',
            defaultModel: 'deepseek-chat',
            defaultWorkspace: 'default',
            theme: 'dark',
            maxAgentSessions: 5,
            providers: {},
        };
    }

    private async loadConfig(): Promise<void> {
        try {
            if (existsSync(this.configPath)) {
                const content = await readFile(this.configPath, 'utf-8');
                this.config = { ...this.getDefaultConfig(), ...JSON.parse(content) };
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
    }

    async getConfig(): Promise<AppConfig> {
        return this.config;
    }

    async updateConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
        this.config = { ...this.config, ...updates };
        await this.saveConfig();
        return this.config;
    }

    private async saveConfig(): Promise<void> {
        try {
            await writeFile(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving config:', error);
            throw error;
        }
    }

    async getProviders(): Promise<string[]> {
        return ['deepseek', 'dashscope', 'openai', 'anthropic'];
    }

    async getModels(provider: string): Promise<string[]> {
        const modelMap: { [key: string]: string[] } = {
            deepseek: ['deepseek-chat', 'deepseek-coder'],
            dashscope: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
            openai: ['gpt-4', 'gpt-3.5-turbo'],
            anthropic: ['claude-3-opus', 'claude-3-sonnet'],
        };
        return modelMap[provider] || [];
    }
}
