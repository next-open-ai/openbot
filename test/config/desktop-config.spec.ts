/**
 * 桌面配置模块单元测试：getDesktopConfig、getBoundAgentIdForCli、loadDesktopAgentConfig
 */
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
    getDesktopConfig,
    getBoundAgentIdForCli,
    loadDesktopAgentConfig,
} from "../../src/config/desktop-config.js";

describe("config/desktop-config", () => {
    let testDir: string;
    let desktopDir: string;
    let originalHome: string | undefined;

    beforeAll(() => {
        originalHome = process.env.HOME;
        testDir = join(tmpdir(), `openbot-desktop-config-test-${Date.now()}`);
        desktopDir = join(testDir, ".openbot", "desktop");
        mkdirSync(desktopDir, { recursive: true });
        process.env.HOME = testDir;
    });

    afterAll(() => {
        if (originalHome !== undefined) process.env.HOME = originalHome;
        else delete process.env.HOME;
        if (existsSync(testDir)) rmSync(testDir, { recursive: true });
    });

    beforeEach(() => {
        // 清空桌面配置目录下的文件，避免用例间互相影响
        try {
            const configPath = join(desktopDir, "config.json");
            const agentsPath = join(desktopDir, "agents.json");
            if (existsSync(configPath)) rmSync(configPath);
            if (existsSync(agentsPath)) rmSync(agentsPath);
        } catch {
            // ignore
        }
    });

    describe("getDesktopConfig", () => {
        it("returns default maxAgentSessions when config.json does not exist", () => {
            const result = getDesktopConfig();
            expect(result.maxAgentSessions).toBe(5);
        });

        it("returns maxAgentSessions from config.json when present", () => {
            writeFileSync(
                join(desktopDir, "config.json"),
                JSON.stringify({ maxAgentSessions: 10 }),
                "utf-8",
            );
            const result = getDesktopConfig();
            expect(result.maxAgentSessions).toBe(10);
        });

        it("returns default when maxAgentSessions is invalid", () => {
            writeFileSync(
                join(desktopDir, "config.json"),
                JSON.stringify({ maxAgentSessions: -1 }),
                "utf-8",
            );
            const result = getDesktopConfig();
            expect(result.maxAgentSessions).toBe(5);
        });
    });

    describe("getBoundAgentIdForCli", () => {
        it("returns default when no config", async () => {
            const id = await getBoundAgentIdForCli();
            expect(id).toBe("default");
        });

        it("returns defaultAgentId from config when set and exists in agents", async () => {
            writeFileSync(
                join(desktopDir, "config.json"),
                JSON.stringify({ defaultAgentId: "my-agent" }),
                "utf-8",
            );
            writeFileSync(
                join(desktopDir, "agents.json"),
                JSON.stringify({ agents: [{ id: "my-agent", workspace: "my-agent", name: "My" }] }),
                "utf-8",
            );
            const id = await getBoundAgentIdForCli();
            expect(id).toBe("my-agent");
        });

        it("returns default when defaultAgentId not in agents", async () => {
            writeFileSync(
                join(desktopDir, "config.json"),
                JSON.stringify({ defaultAgentId: "missing" }),
                "utf-8",
            );
            writeFileSync(
                join(desktopDir, "agents.json"),
                JSON.stringify({ agents: [{ id: "default", workspace: "default", name: "Main" }] }),
                "utf-8",
            );
            const id = await getBoundAgentIdForCli();
            expect(id).toBe("default");
        });
    });

    describe("loadDesktopAgentConfig", () => {
        it("returns default provider/model when config.json does not exist", async () => {
            const result = await loadDesktopAgentConfig("default");
            expect(result).not.toBeNull();
            expect(result!.provider).toBe("deepseek");
            expect(result!.model).toBe("deepseek-chat");
            expect(result!.apiKey).toBeUndefined();
        });

        it("returns provider/model/apiKey for default agent from config and agents", async () => {
            writeFileSync(
                join(desktopDir, "config.json"),
                JSON.stringify({
                    defaultProvider: "openai",
                    defaultModel: "gpt-4",
                    providers: { openai: { apiKey: "sk-test" } },
                }),
                "utf-8",
            );
            writeFileSync(
                join(desktopDir, "agents.json"),
                JSON.stringify({
                    agents: [{ id: "default", workspace: "default", provider: "openai", model: "gpt-4" }],
                }),
                "utf-8",
            );
            const result = await loadDesktopAgentConfig("default");
            expect(result).not.toBeNull();
            expect(result!.provider).toBe("openai");
            expect(result!.model).toBe("gpt-4");
            expect(result!.apiKey).toBe("sk-test");
        });

        it("uses agent-specific provider/model when present in agents", async () => {
            writeFileSync(
                join(desktopDir, "config.json"),
                JSON.stringify({
                    defaultProvider: "deepseek",
                    defaultModel: "deepseek-chat",
                    providers: {
                        deepseek: { apiKey: "sk-ds" },
                        dashscope: { apiKey: "sk-dash" },
                    },
                }),
                "utf-8",
            );
            writeFileSync(
                join(desktopDir, "agents.json"),
                JSON.stringify({
                    agents: [
                        { id: "default", workspace: "default" },
                        { id: "qwen", workspace: "qwen", provider: "dashscope", model: "qwen-max" },
                    ],
                }),
                "utf-8",
            );
            const result = await loadDesktopAgentConfig("qwen");
            expect(result).not.toBeNull();
            expect(result!.provider).toBe("dashscope");
            expect(result!.model).toBe("qwen-max");
            expect(result!.apiKey).toBe("sk-dash");
        });
    });
});
