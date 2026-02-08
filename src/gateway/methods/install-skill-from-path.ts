/**
 * 在 Gateway 层处理 POST /server-api/skills/install-from-path，
 * 将本地技能目录复制到全局或工作区 skills，不依赖 Nest 路由，保证桌面端稳定可用。
 */
import { cp, mkdir, realpath, rm, stat } from "fs/promises";
import { existsSync } from "fs";
import { basename, join, resolve } from "path";
import { getFreebotAgentDir, getFreebotWorkspaceDir } from "../../agent/agent-dir.js";

const SKILL_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

function getGlobalSkillsDir(): string {
    return join(getFreebotAgentDir(), "skills");
}

function getWorkspaceSkillsDir(workspaceName: string): string {
    return join(getFreebotWorkspaceDir(), workspaceName, "skills");
}

export interface InstallFromPathBody {
    path: string;
    scope?: "global" | "workspace";
    workspace?: string;
}

export interface InstallFromPathResult {
    success: true;
    data: { installDir: string; name: string };
}

export async function handleInstallSkillFromPath(body: InstallFromPathBody): Promise<InstallFromPathResult> {
    const localPath = (body?.path ?? "").trim();
    if (!localPath) {
        throw new Error("path is required");
    }
    const pathToUse = resolve(localPath);
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
    const scope = body?.scope ?? "global";
    const workspaceName = body?.workspace ?? "default";
    const targetDir = scope === "workspace" ? getWorkspaceSkillsDir(workspaceName) : getGlobalSkillsDir();
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
    return { success: true, data: { installDir: targetDir, name: baseName } };
}
