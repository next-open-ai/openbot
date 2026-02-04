#!/usr/bin/env node
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { getFreebotAgentDir } from "./agent/agent-dir.js";
import { loadSkillsFromPaths, type Skill } from "./agent/skills.js";
import { run } from "./agent/run.js";
import { ConfigManager } from "./agent/config-manager.js";

const require = createRequire(import.meta.url);
const PKG = require("../package.json") as { version: string };

/** 应用安装目录下的 skills 路径（未传 -s 时使用）；基于 dist/cli.js 所在目录推算包根目录 */
function getDefaultSkillsDir(): string {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    return join(__dirname, "..", "skills");
}

async function runAction(
    positionalPrompt: string | undefined,
    opts: {
        skillPath?: string[];
        prompt?: string;
        dryRun?: boolean;
        model?: string;
        provider?: string;
        agentDir?: string;
        apiKey?: string;
        timing?: boolean;
        maxToolTurns?: number;
    },
): Promise<void> {
    const skillPaths =
        opts.skillPath && opts.skillPath.length > 0 ? opts.skillPath : [getDefaultSkillsDir()];
    const prompt = (opts.prompt ?? positionalPrompt ?? "").trim();

    if (!prompt) {
        console.error("Error: 请提供提示词（位置参数或 --prompt）");
        process.exit(1);
    }

    const skills: Skill[] = loadSkillsFromPaths(skillPaths);
    if (skills.length === 0) {
        console.warn("Warning: 未从给定路径加载到任何 skill，将使用空技能列表运行");
    } else {
        console.error(
            `[freebot] 已加载 ${skills.length} 个 skill: ${skills.map((s) => s.name).join(", ")}`,
        );
    }

    const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    if (opts.timing) process.env.FREEBOT_TIMING = "1";

    try {
        const result = await run({
            skills,
            userPrompt: prompt,
            dryRun: opts.dryRun ?? false,
            model: opts.model ?? "deepseek-chat",
            provider: opts.provider ?? "deepseek",
            agentDir: opts.agentDir ?? getFreebotAgentDir(),
            apiKey: apiKey || undefined,
        });

        if (result.dryRun) {
            console.log("=== System prompt (skills) ===");
            console.log(result.systemPrompt);
            console.log("\n=== User prompt ===");
            console.log(result.userPrompt);
            console.log("\n(dry-run: 未调用 LLM，设置 OPENAI_API_KEY 可实际调用)");
            return;
        }
        // Content is already streamed by run()
        if (
            !result.dryRun &&
            (result.assistantContent === undefined || result.assistantContent === "")
        ) {
            console.warn(
                "（模型返回为空；若此前有工具调用提示，说明当前为单轮模式，模型会基于技能描述直接以文本回答。）",
            );
        }
    } catch (err: unknown) {
        console.error(err);
        process.exit(1);
    }
}

const program = new Command();

program
    .name("freebot")
    .description("CLI to run prompts with skill paths (Agent Skills style)")
    .version(PKG.version, "-v, --version", "显示版本号")
    .option(
        "-s, --skill-path <paths...>",
        "Skill 目录或单个 .md 文件路径，可多次指定；不传则使用安装目录下的 skills",
    )
    .option("-p, --prompt <text>", "用户提示词（与位置参数二选一）")
    .option("--dry-run", "只输出组装的 system/user 内容，不调用 LLM")
    .option("--model <id>", "模型 ID", "deepseek-chat")
    .option(
        "--provider <name>",
        "Provider（pi ModelRegistry）；可选 deepseek、dashscope、openai",
        "deepseek",
    )
    .option(
        "--agent-dir <path>",
        "Agent 配置目录（默认 ~/.freebot/agent）",
        getFreebotAgentDir(),
    )
    .option("--api-key <key>", "API Key（不传则使用环境变量 OPENAI_API_KEY）")
    .option("--timing", "打印每轮 LLM 与 tool 耗时到 stderr")
    .option(
        "--max-tool-turns <n>",
        "最大工具调用轮数（默认 30）；可设环境变量 FREEBOT_MAX_TOOL_TURNS",
        (v: string) => parseInt(v, 10) || 0,
        0,
    )
    .argument("[prompt]", "用户提示词（与 --prompt 二选一）")
    .action(async (positionalPrompt: string | undefined) => {
        await runAction(positionalPrompt, program.opts());
    });

program.addHelpText(
    "after",
    `
Environment:
  DEEPSEEK_API_KEY          默认 provider 为 deepseek 时使用；不设时回退 OPENAI_API_KEY
  OPENAI_API_KEY            通用 API Key（可被 --api-key 覆盖）
  DASHSCOPE_API_KEY         provider=dashscope 时使用；不设时回退 OPENAI_API_KEY
  OPENAI_BASE_URL           可选，在 pi 未找到模型时使用的 endpoint
  FREEBOT_AGENT_DIR         缺省 agent 目录（默认 ~/.freebot/agent）
  FREEBOT_TIMING=1          等同 --timing
  FREEBOT_ALLOW_RUN_CODE    缺省 1（启用 run_python）；设为 0 关闭
  FREEBOT_MAX_TOOL_TURNS    最大工具轮数（默认 30）

Examples:
  freebot "总结一下当前有哪些技能"
  freebot -s ./skills "总结一下当前有哪些技能"
  freebot -s ./my-skills --prompt "用 weather 技能查北京天气" --dry-run
`,
);

// Gateway server command
program
    .command("gateway")
    .description("Start WebSocket gateway server")
    .option("-p, --port <port>", "Port to listen on", "3000")
    .action(async (options) => {
        const port = parseInt(options.port, 10);
        if (isNaN(port) || port <= 0 || port > 65535) {
            console.error("Error: Invalid port number");
            process.exit(1);
        }

        const { startGatewayServer } = await import("./gateway/index.js");
        const { close } = await startGatewayServer(port);

        // Handle graceful shutdown
        const shutdown = async () => {
            console.log("\nShutting down...");
            await close();
            process.exit(0);
        };

        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);
    });

// Login command
program
    .command("login")
    .description("Save API key for a provider persistently")
    .argument("<provider>", "Provider name (e.g., deepseek, dashscope, openai)")
    .argument("<apiKey>", "API Key")
    .action(async (provider, apiKey) => {
        const config = new ConfigManager(program.opts().agentDir);
        await config.login(provider, apiKey);
    });

// Config command
const configCmd = program.command("config").description("Manage configurations");

configCmd
    .command("set-model")
    .description("Set default model for a provider")
    .argument("<provider>", "Provider name")
    .argument("<modelId>", "Model ID")
    .action(async (provider, modelId) => {
        const cm = new ConfigManager(program.opts().agentDir);
        await cm.setModel(provider, modelId);
    });

configCmd
    .command("list")
    .description("List current configurations")
    .action(() => {
        const cm = new ConfigManager(program.opts().agentDir);
        const results = cm.list();
        if (results.length === 0) {
            console.log("No providers found in models.json.");
        } else {
            console.table(results.map(r => ({
                Provider: r.provider,
                "Default Model": r.model,
                "Auth Configured": r.hasKey ? "✅ Yes" : "❌ No"
            })));
        }
    });

program.parseAsync(process.argv).catch((err: unknown) => {
    console.error(err);
    process.exit(1);
});
