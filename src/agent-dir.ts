import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * 获取 freebot agent 配置目录（默认 ~/.freebot/agent）
 * 可通过环境变量 FREEBOT_AGENT_DIR 覆盖
 */
export function getFreebotAgentDir(): string {
    return process.env.FREEBOT_AGENT_DIR ?? join(homedir(), ".freebot", "agent");
}

/**
 * 确保 agent 目录存在，并创建默认配置文件
 */
export function ensureDefaultAgentDir(agentDir: string): void {
    if (!existsSync(agentDir)) {
        mkdirSync(agentDir, { recursive: true });
    }

    const modelsJsonPath = join(agentDir, "models.json");
    if (!existsSync(modelsJsonPath)) {
        const defaultModels = {
            providers: [
                {
                    id: "deepseek",
                    name: "DeepSeek",
                    apiKey: "OPENAI_API_KEY",
                    api: "openai-completions",
                    baseUrl: "https://api.deepseek.com",
                    models: [
                        {
                            id: "deepseek-chat",
                            name: "DeepSeek Chat",
                            contextWindow: 64000,
                            supportsTools: true
                        }
                    ]
                },
                {
                    id: "dashscope",
                    name: "DashScope (Alibaba)",
                    apiKeyEnvVar: "DASHSCOPE_API_KEY",
                    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
                    models: [
                        {
                            id: "qwen-max",
                            name: "Qwen Max",
                            contextWindow: 30000,
                            supportsTools: true
                        }
                    ]
                }
            ]
        };
        writeFileSync(modelsJsonPath, JSON.stringify(defaultModels, null, 2), "utf-8");
    }
}
