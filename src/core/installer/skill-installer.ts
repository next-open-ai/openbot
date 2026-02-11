/**
 * 核心安装模块：按 URL 或按路径安装技能到全局或工作区，不依赖 Nest。
 * 供 install_skill 工具、Gateway、CLI 等统一使用。
 */
import { readFile, readdir, stat, mkdir, rm, cp, realpath } from "fs/promises";
import { existsSync } from "fs";
import { join, resolve, basename } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { exec } from "child_process";
import { promisify } from "util";
import { homedir } from "os";
import { getOpenbotAgentDir, getOpenbotWorkspaceDir } from "../agent/agent-dir.js";

const execAsync = promisify(exec);

function getDesktopDir(): string {
    const home = process.env.HOME || process.env.USERPROFILE || homedir();
    return join(home, ".openbot", "desktop");
}

interface AgentItem {
    id: string;
    workspace: string;
}

interface AgentsFile {
    agents?: AgentItem[];
}

/** 解析 targetAgentId 得到安装目标：global 或 workspace + 工作区名 */
export async function resolveInstallTarget(
    targetAgentId: string | undefined,
): Promise<{ scope: "global" | "workspace"; workspace: string }> {
    const tid = (targetAgentId ?? "").trim().toLowerCase();
    if (tid === "global" || tid === "all") {
        return { scope: "global", workspace: "default" };
    }
    if (!tid) {
        return { scope: "workspace", workspace: "default" };
    }
    const agentsPath = join(getDesktopDir(), "agents.json");
    if (!existsSync(agentsPath)) {
        return { scope: "workspace", workspace: tid };
    }
    try {
        const raw = await readFile(agentsPath, "utf-8");
        const data = JSON.parse(raw) as AgentsFile;
        const agents = Array.isArray(data.agents) ? data.agents : [];
        const agent = agents.find((a) => a.id === tid);
        const workspace = agent?.workspace?.trim() || tid;
        return { scope: "workspace", workspace };
    } catch {
        return { scope: "workspace", workspace: tid };
    }
}

function getGlobalSkillsDir(): string {
    return join(getOpenbotAgentDir(), "skills");
}

function getWorkspaceSkillsDir(workspaceName: string): string {
    return join(getOpenbotWorkspaceDir(), workspaceName, "skills");
}

export interface InstallByUrlOptions {
    scope: "global" | "workspace";
    workspace?: string;
}

export interface InstallByUrlResult {
    stdout: string;
    stderr: string;
    installDir: string;
}

/**
 * 通过 npx skills add 安装技能到指定目录（与 Nest SkillsService 逻辑一致）。
 */
export async function installSkillByUrl(
    url: string,
    options: InstallByUrlOptions = { scope: "global", workspace: "default" },
): Promise<InstallByUrlResult> {
    const scope = options.scope ?? "global";
    const workspaceName = options.workspace ?? "default";
    const targetDir =
        scope === "workspace"
            ? getWorkspaceSkillsDir(workspaceName)
            : getGlobalSkillsDir();

    const tempDir = join(tmpdir(), `openbot-skills-${randomUUID()}`);
    const tempAgentsSkills = join(tempDir, ".agents", "skills");
    const tempPiSkills = join(tempDir, ".pi", "skills");
    let stdout = "";
    let stderr = "";
    try {
        await mkdir(tempPiSkills, { recursive: true });
        const { stdout: out, stderr: err } = await execAsync(
            `npx skills add "${url.trim()}" -a pi -y`,
            { cwd: tempDir, maxBuffer: 4 * 1024 * 1024 },
        );
        stdout = out || "";
        stderr = err || "";
        await mkdir(targetDir, { recursive: true });
        const sourceDir = existsSync(tempAgentsSkills) ? tempAgentsSkills : tempPiSkills;
        const entries = await readdir(sourceDir).catch(() => []);
        for (const entry of entries) {
            const src = join(sourceDir, entry);
            const entryStat = await stat(src).catch(() => null);
            if (!entryStat?.isDirectory()) continue;
            const dest = join(targetDir, entry);
            const srcResolved = await realpath(src).catch(() => src);
            await cp(srcResolved, dest, { recursive: true });
        }
    } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
    return { stdout, stderr, installDir: targetDir };
}

const SKILL_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

export interface InstallFromPathOptions {
    scope: "global" | "workspace";
    workspace?: string;
}

export interface InstallFromPathResult {
    installDir: string;
    name: string;
}

/**
 * 从本地目录安装技能：将指定目录复制到目标 skills 目录。
 */
export async function installSkillFromPath(
    localPath: string,
    options: InstallFromPathOptions = { scope: "global", workspace: "default" },
): Promise<InstallFromPathResult> {
    const pathToUse = resolve(localPath.trim());
    if (!existsSync(pathToUse)) {
        throw new Error("本地路径不存在");
    }
    const pathStat = await stat(pathToUse);
    if (!pathStat.isDirectory()) {
        throw new Error("请选择技能目录");
    }
    const skillMdPath = join(pathToUse, "SKILL.md");
    if (!existsSync(skillMdPath)) {
        throw new Error("该目录下未找到 SKILL.md，不是有效的技能目录");
    }
    const scope = options.scope ?? "global";
    const workspaceName = options.workspace ?? "default";
    const targetDir =
        scope === "workspace"
            ? getWorkspaceSkillsDir(workspaceName)
            : getGlobalSkillsDir();
    const baseName = basename(pathToUse) || "skill";
    if (!baseName || !SKILL_NAME_REGEX.test(baseName)) {
        throw new Error("技能目录名须为英文、数字、下划线或连字符");
    }
    const destPath = join(targetDir, baseName);
    await mkdir(targetDir, { recursive: true });
    if (existsSync(destPath)) {
        await rm(destPath, { recursive: true });
    }
    const srcResolved = await realpath(pathToUse).catch(() => pathToUse);
    await cp(srcResolved, destPath, { recursive: true });
    return { installDir: targetDir, name: baseName };
}
