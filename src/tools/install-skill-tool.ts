import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const InstallSkillSchema = Type.Object({
    url: Type.String({
        description: "Skill 安装地址，如 GitHub 简写 owner/repo、完整 URL 或 owner/repo@skillName",
    }),
});

type InstallSkillParams = { url: string };

/**
 * 创建 install_skill 工具：通过后端 API 安装技能。
 * @param targetAgentId 安装目标（具体 agentId / "global"|"all" / 未传则后端默认）
 * @param backendBaseUrl 后端 base URL（如 http://localhost:3001），由调用方注入；不传则工具返回「未连接后端」提示
 */
export function createInstallSkillTool(
    targetAgentId: string | undefined,
    backendBaseUrl?: string,
): ToolDefinition {
    return {
        name: "install_skill",
        label: "Install Skill",
        description:
            "将指定地址的技能安装到当前智能体工作区目录。在 OpenBot 中为用户安装技能时，" +
            "应使用本工具而非 npx skills add，以保证安装到当前智能体对应的技能目录。",
        parameters: InstallSkillSchema,
        execute: async (
            _toolCallId: string,
            params: InstallSkillParams,
            _signal: AbortSignal | undefined,
            _onUpdate: any,
            _ctx: any,
        ) => {
            const url = (params.url ?? "").trim();
            if (!url) {
                return {
                    content: [{ type: "text" as const, text: "请提供技能安装地址（如 owner/repo 或 owner/repo@skillName）。" }],
                    details: undefined,
                };
            }
            const base = backendBaseUrl?.trim();
            if (!base) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: "当前环境未连接后端，无法通过工具安装。请让用户在应用内使用「手动安装」并填入该地址：" + url,
                        },
                    ],
                    details: undefined,
                };
            }
            const installUrl = `${base.replace(/\/$/, "")}/server-api/skills/install`;
            try {
                const res = await fetch(installUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url, targetAgentId: targetAgentId }),
                });
                const data = (await res.json().catch(() => ({}))) as {
                    success?: boolean;
                    data?: { stdout?: string; stderr?: string; installDir?: string };
                    message?: string;
                };
                if (!res.ok) {
                    const msg = data?.message ?? data?.data?.stderr ?? res.statusText;
                    return {
                        content: [{ type: "text" as const, text: `安装请求失败: ${msg}` }],
                        details: undefined,
                    };
                }
                const out = data?.data?.stdout ?? "";
                const err = data?.data?.stderr ?? "";
                const installDir = data?.data?.installDir;
                const dirLine = installDir ? `\n安装目录：${installDir}` : "";
                const baseText =
                    out.trim() || (err.trim() ? `安装完成。\n${err}` : "技能已安装完成。");
                const text = dirLine ? `${baseText}${dirLine}` : baseText;
                return {
                    content: [{ type: "text" as const, text }],
                    details: data?.data,
                };
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return {
                    content: [{ type: "text" as const, text: `安装请求异常: ${msg}` }],
                    details: undefined,
                };
            }
        },
    };
}
