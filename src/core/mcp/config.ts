/**
 * MCP 配置解析与校验。
 * 从 getOrCreateSession 的 options.mcpServers 中取出并规范化，仅使用明确支持的 transport。
 */

import type { McpServerConfig, McpServerConfigStdio } from "./types.js";

/**
 * 从会话选项里解析出本会话启用的 MCP 服务器配置列表。
 * 仅保留 stdio 配置；SSE 等预留扩展在此过滤并打日志。
 */
export function resolveMcpServersForSession(mcpServers: McpServerConfig[] | undefined): McpServerConfigStdio[] {
    if (!Array.isArray(mcpServers) || mcpServers.length === 0) {
        return [];
    }
    const result: McpServerConfigStdio[] = [];
    for (const s of mcpServers) {
        if (!s || typeof s !== "object") continue;
        if (s.transport === "stdio") {
            if (typeof (s as McpServerConfigStdio).command !== "string" || !(s as McpServerConfigStdio).command.trim()) {
                console.warn("[mcp] 跳过无效 stdio 配置：缺少或无效 command");
                continue;
            }
            result.push({
                transport: "stdio",
                command: (s as McpServerConfigStdio).command.trim(),
                args: Array.isArray((s as McpServerConfigStdio).args) ? (s as McpServerConfigStdio).args : undefined,
                env: (s as McpServerConfigStdio).env && typeof (s as McpServerConfigStdio).env === "object" ? (s as McpServerConfigStdio).env : undefined,
            });
        } else if (s.transport === "sse") {
            console.warn("[mcp] 暂不支持 SSE 传输，已跳过");
        } else {
            console.warn("[mcp] 未知 transport:", (s as McpServerConfig).transport);
        }
    }
    return result;
}

/**
 * 为 stdio 配置生成缓存键（用于 Operator 复用同一进程连接）
 */
export function stdioConfigKey(config: McpServerConfigStdio): string {
    const args = (config.args ?? []).join(" ");
    const envStr = config.env ? JSON.stringify(config.env) : "";
    return `${config.command}\0${args}\0${envStr}`;
}
