import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import type { Skill } from "./skills.js";

/** 缺省 1：未设置或为 "1" 时启用 run_python；设为 "0" 关闭 */
const ALLOW_RUN_CODE = (process.env.FREEBOT_ALLOW_RUN_CODE ?? "1") !== "0";

/** 解析 @freebot/openbot 同装的 agent-browser 可执行路径；若未安装则返回 "agent-browser"（依赖 PATH） */
function getAgentBrowserBin(): string {
    try {
        const openbotRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
        const requireFromPkg = createRequire(join(openbotRoot, "package.json"));
        const agentBrowserPkgPath = requireFromPkg.resolve("agent-browser/package.json");
        const binJs = join(dirname(agentBrowserPkgPath), "bin", "agent-browser.js");
        const binNative = join(dirname(agentBrowserPkgPath), "bin", "agent-browser");
        if (existsSync(binJs)) return binJs;
        if (existsSync(binNative)) return binNative;
    } catch {
        // 未安装 agent-browser 依赖时回退到 PATH
    }
    return "agent-browser";
}

/** 常见 Python 模块名 -> pip 包名（import 名与 pip 名不一致时） */
const MODULE_TO_PIP: Record<string, string> = {
    pptx: "python-pptx",
    PIL: "Pillow",
    cv2: "opencv-python",
    sklearn: "scikit-learn",
    yaml: "PyYAML",
    dateutil: "python-dateutil",
    OpenSSL: "pyOpenSSL",
};

/** 通用「读取技能内容」工具：模型可请求查看某技能的完整说明 */
function makeReadSkillTool(skills: Skill[]): Tool {
    const names = skills.map((s) => s.name).join(", ");
    return {
        name: "read_skill",
        description: `Read full skill content by name. Available: ${names}.`,
        parameters: Type.Object({
            skill_name: Type.String({ description: "Skill name" }),
        }),
    };
}

/** 可选：执行 Python 代码（需 FREEBOT_ALLOW_RUN_CODE=1），用于执行模型生成的脚本（如生成 PDF） */
const runPythonTool: Tool = {
    name: "run_python",
    description: "Execute Python 3 code; return stdout/stderr. Embed real content as strings, no placeholders.",
    parameters: Type.Object({
        code: Type.String({ description: "Python 3 code (runs in cwd)" }),
    }),
};

/** agent-browser CLI 工具：直接调用系统上的 agent-browser 命令 */
const runAgentBrowserTool: Tool = {
    name: "run_agent_browser",
    description: "Run agent-browser CLI: open URL, snapshot -i, fill/click by @ref. Use TEXTBOX ref for fill, not link.",
    parameters: Type.Object({
        args: Type.String({ description: 'e.g. \'open https://...\' or \'snapshot -i\' or \'fill @e13 "text"\'' }),
    }),
};

/**
 * 根据已加载的 skills 生成 pi-ai 可用的 Tool[]
 * - 若存在 agent-browser 技能，加入 run_agent_browser（直接调 CLI）
 * - 加入 read_skill，天气等能力通过 read_skill(weather) 获取技能说明后按技能执行
 * - 若 FREEBOT_ALLOW_RUN_CODE=1，加入 run_python
 */
export function buildToolsFromSkills(skills: Skill[]): Tool[] {
    const tools: Tool[] = [];
    const hasAgentBrowser = skills.some((s) => s.name.toLowerCase() === "agent-browser");
    if (hasAgentBrowser) tools.push(runAgentBrowserTool);
    tools.push(makeReadSkillTool(skills));
    if (ALLOW_RUN_CODE) tools.push(runPythonTool);
    return tools;
}

/**
 * 执行 skill 对应的 tool 调用，返回供 ToolResultMessage 使用的文本
 */
export async function executeSkillTool(
    toolName: string,
    args: Record<string, unknown>,
    skills: Skill[],
): Promise<{ text: string; isError: boolean }> {
    if (toolName === "read_skill") {
        const skillName = (args?.skill_name as string)?.trim();
        if (!skillName) return { text: "请提供 skill_name 参数。", isError: true };
        const skill = skills.find((s) => s.name.toLowerCase() === skillName.toLowerCase());
        if (!skill) return { text: `未找到技能: ${skillName}。可用: ${skills.map((s) => s.name).join(", ")}`, isError: true };
        try {
            const raw = skill.filePath ? readFileSync(skill.filePath, "utf-8") : `${skill.name}: ${skill.description}`;
            return { text: raw, isError: false };
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { text: `读取技能失败: ${msg}`, isError: true };
        }
    }

    if (toolName === "run_agent_browser") {
        const argStr = (args?.args as string)?.trim();
        if (!argStr) return { text: "请提供 args 参数，例如：open https://www.baidu.com 或 snapshot -i", isError: true };
        const agentBrowserBin = getAgentBrowserBin();
        const cmd = agentBrowserBin.endsWith(".js")
            ? `node "${agentBrowserBin}" ${argStr}`
            : `"${agentBrowserBin}" ${argStr}`;
        try {
            const out = execSync(cmd, {
                encoding: "utf-8",
                timeout: 60_000,
                maxBuffer: 10 * 1024 * 1024,
                cwd: process.cwd(),
                shell: "/bin/sh",
            });
            return { text: (out ?? "").trim() || "（执行完成，无输出）", isError: false };
        } catch (e: unknown) {
            const err = e as { stdout?: string; stderr?: string; message?: string };
            const stdout = (err?.stdout ?? "").trim();
            const stderr = (err?.stderr ?? "").trim();
            const msg = err?.message ?? String(e);
            const combined = [stdout, stderr, msg].filter(Boolean).join("\n");
            return { text: combined || "agent-browser 执行失败", isError: true };
        }
    }

    if (toolName === "run_python" && ALLOW_RUN_CODE) {
        const code = (args?.code as string)?.trim();
        if (!code) return { text: "请提供 code 参数。", isError: true };
        const tmpFile = join(tmpdir(), `freebot-${Date.now()}-${Math.random().toString(36).slice(2)}.py`);
        const runOnce = (): { ok: true; out: string } | { ok: false; err: string } => {
            try {
                const out = execSync(`python3 "${tmpFile}"`, {
                    encoding: "utf-8",
                    timeout: 30_000,
                    cwd: process.cwd(),
                });
                return { ok: true, out: (out ?? "").trim() || "（执行完成，无输出）" };
            } catch (e: unknown) {
                const err = e as { stdout?: string; stderr?: string; message?: string };
                const stdout = (err?.stdout ?? "").trim();
                const stderr = (err?.stderr ?? "").trim();
                const msg = err?.message ?? String(e);
                const combined = [stdout, stderr, msg].filter(Boolean).join("\n");
                return { ok: false, err: combined || "执行失败" };
            }
        };
        try {
            writeFileSync(tmpFile, code, "utf-8");
            let result = runOnce();
            const modMatch = !result.ok && "err" in result && result.err.match(/ModuleNotFoundError:\s*No module named\s+['"]([^'"]+)['"]/);
            if (modMatch) {
                const moduleName = modMatch[1].trim();
                const pipName = MODULE_TO_PIP[moduleName] ?? moduleName;
                const originalErr = result.ok ? "" : result.err;
                try {
                    execSync(`python3 -m pip install --quiet "${pipName}"`, {
                        encoding: "utf-8",
                        timeout: 60_000,
                        stdio: "pipe",
                    });
                    result = runOnce();
                } catch (_pipErr) {
                    result = {
                        ok: false,
                        err: `${originalErr}\n\n（已尝试 pip install ${pipName}，安装失败或仍无法运行）`,
                    };
                }
            }
            if (result.ok) return { text: result.out, isError: false };
            return { text: result.err, isError: true };
        } finally {
            try {
                unlinkSync(tmpFile);
            } catch {
                // ignore
            }
        }
    }

    return { text: `未知工具: ${toolName}`, isError: true };
}

/**
 * 从 Markdown 文本中提取第一个 ```python ... ``` 代码块
 */
export function extractPythonCodeBlock(text: string): string | null {
    const match = text.match(/```python\s*\n([\s\S]*?)```/i);
    return match ? match[1].trim() : null;
}

/**
 * 当启用 FREEBOT_ALLOW_RUN_CODE 且回复中包含 ```python 块时，执行该代码并返回执行结果；
 * 否则返回 null（调用方将不追加任何内容）
 */
export async function runPythonCodeFromResponse(
    text: string,
    skills: Skill[],
): Promise<{ output: string; isError: boolean } | null> {
    if (!ALLOW_RUN_CODE) return null;
    const code = extractPythonCodeBlock(text);
    if (!code) return null;
    const result = await executeSkillTool("run_python", { code }, skills);
    return { output: result.text, isError: result.isError };
}
