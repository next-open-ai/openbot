/**
 * MCP (Model Context Protocol) 相关类型定义。
 * 仅实现 Client 端 Tools 能力；Resources/Prompts 类型预留扩展。
 */

/** stdio 传输：通过子进程 stdin/stdout 进行 JSON-RPC 通信 */
export interface McpServerConfigStdio {
    transport: "stdio";
    /** 可执行路径（禁止从用户输入拼接，需白名单或配置） */
    command: string;
    /** 命令行参数 */
    args?: string[];
    /** 环境变量（可选，合并到 process.env） */
    env?: Record<string, string>;
}

/** SSE 传输：预留，二期实现 */
export interface McpServerConfigSse {
    transport: "sse";
    url: string;
    headers?: Record<string, string>;
}

/** 单条 MCP 服务器配置（由调用方在创建 Session 时传入，与 Skill 类似） */
export type McpServerConfig = McpServerConfigStdio | McpServerConfigSse;

/** MCP 协议中 Tool 的 inputSchema 为 JSON Schema 对象 */
export interface McpToolInputSchema {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
}

/** MCP tools/list 返回的单个工具描述 */
export interface McpTool {
    name: string;
    description?: string;
    inputSchema?: McpToolInputSchema;
}

/** MCP tools/call 返回的 content 项 */
export interface McpToolCallContentItem {
    type: "text";
    text: string;
}

/** MCP tools/call 的 result */
export interface McpToolCallResult {
    content: McpToolCallContentItem[];
    isError?: boolean;
}

/** JSON-RPC 2.0 请求 */
export interface JsonRpcRequest {
    jsonrpc: "2.0";
    id: number | string;
    method: string;
    params?: unknown;
}

/** JSON-RPC 2.0 成功响应 */
export interface JsonRpcResponse<T = unknown> {
    jsonrpc: "2.0";
    id: number | string;
    result?: T;
    error?: { code: number; message: string; data?: unknown };
}
