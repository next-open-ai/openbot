/**
 * WebSocket Gateway 入口：提供 WS JSON-RPC（如 agent.chat），并代理 /server-api 到 Desktop 后端（src/server/）。
 * 与 Nest Desktop Backend 是不同进程；本进程可拉 Nest 子进程并转发请求。
 */
/* Avoid MaxListenersExceededWarning: Browser Tool / Playwright attach abort listeners to same AbortSignal; Node default maxListeners is 10. */
const Et = (globalThis as any).EventTarget;
if (Et?.prototype?.addEventListener && Et.prototype.setMaxListeners) {
    const add = Et.prototype.addEventListener;
    Et.prototype.addEventListener = function (this: any, type: string, listener: any, options?: any) {
        if (type === "abort" && typeof this.setMaxListeners === "function") {
            this.setMaxListeners(32);
        }
        return add.call(this, type, listener, options);
    };
}

import { WebSocketServer } from "ws";
import { createServer, request as httpRequest, type Server, type IncomingMessage, type ServerResponse, type RequestOptions } from "http";
import { handleConnection } from "./connection-handler.js";
import { readFile, stat } from "fs/promises";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "node:url";
import { existsSync } from "fs";
import { spawn, type ChildProcess } from "child_process";
import { createServer as createNetServer } from "net";
import { handleRunScheduledTask } from "./methods/run-scheduled-task.js";
import { handleInstallSkillFromPath } from "./methods/install-skill-from-path.js";
import { setBackendBaseUrl } from "./backend-url.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** 包根目录（dist/gateway 的上级的上级），npm 安装后静态资源在 desktop/renderer/dist */
const PACKAGE_ROOT = join(__dirname, "..", "..");
const STATIC_DIR = join(PACKAGE_ROOT, "desktop", "renderer", "dist");

/**
 * Find an available port starting from startPort
 */
async function findAvailablePort(startPort: number): Promise<number> {
    let port = startPort;
    while (true) {
        try {
            await new Promise<void>((resolve, reject) => {
                const server = createNetServer();
                server.once("error", (err: any) => {
                    if (err.code === "EADDRINUSE") {
                        resolve(); // Port taken, try next
                    } else {
                        reject(err);
                    }
                });
                server.once("listening", () => {
                    server.close(() => resolve()); // Port available
                });
                server.listen(port);
            });
            // If we get here and the server listened successfully (then closed), checking if it was actually available logic needs care.
            // Actually the above logic is slightly flawed for "resolve on error".
            // Let's refine:
            // If listen succeeds -> port is free. return it.
            // If EADDRINUSE -> port busy. loop continue.

            const isAvailable = await new Promise<boolean>((resolve) => {
                const server = createNetServer();
                server.once("error", () => resolve(false));
                server.once("listening", () => {
                    server.close(() => resolve(true));
                });
                server.listen(port);
            });

            if (isAvailable) return port;
            port++;
        } catch (e) {
            port++;
        }
    }
}

/**
 * MIME types for static files
 */
const MIME_TYPES: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
};

/**
 * Start WebSocket gateway server
 */
export async function startGatewayServer(port: number = 38080): Promise<{
    httpServer: Server;
    wss: WebSocketServer;
    close: () => Promise<void>;
}> {
    console.log(`Starting gateway server on port ${port}...`);

    // 1. Find available port for Desktop Server
    const backendPort = await findAvailablePort(38081);
    console.log(`Found available port for Desktop Server: ${backendPort}`);
    setBackendBaseUrl(`http://localhost:${backendPort}`);

    // 2. Start Desktop Server（从包根目录找 dist/server，npm 全局安装时也能启动）
    let backendProcess: ChildProcess | null = null;
    const serverPath = join(PACKAGE_ROOT, "dist", "server", "main.js");

    if (existsSync(serverPath)) {
        console.log(`Spawning Desktop Server at ${serverPath}...`);
        backendProcess = spawn("node", [serverPath], {
            cwd: PACKAGE_ROOT,
            env: { ...process.env, PORT: backendPort.toString() },
            stdio: ["ignore", "pipe", "pipe"], // Pipe stdout/stderr to capture logs
        });

        backendProcess.stdout?.on("data", (data: Buffer) => {
            const str = data.toString().trim();
            if (str) console.log(`[Desktop Server] ${str}`);
        });

        backendProcess.stderr?.on("data", (data: Buffer) => {
            const str = data.toString().trim();
            if (str) console.error(`[Desktop Server Error] ${str}`);
        });

        backendProcess.on("exit", (code: number | null) => {
            if (code !== 0 && code !== null) {
                console.error(`Desktop Server exited with code ${code}`);
            }
        });
    } else {
        console.warn("⚠️ Desktop Server build not found. Skipping auto-start.");
        console.warn("   Run 'npm run desktop:build' to build the server.");
    }

    // Create HTTP server
    const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        // Simple health check endpoint
        if (req.url === "/health") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
            return;
        }

        // Scheduled task: run agent and POST assistant message back to Nest
        const pathname = req.url?.split("?")[0] || "";
        if (req.method === "POST" && pathname === "/run-scheduled-task") {
            await handleRunScheduledTask(req, res);
            return;
        }

        // 本地技能目录安装：在 Gateway 层直接处理，不依赖 Nest，保证桌面端稳定可用
        if (req.method === "POST" && pathname === "/server-api/skills/install-from-path") {
            const body = await new Promise<string>((resolve, reject) => {
                const chunks: Buffer[] = [];
                req.on("data", (chunk) => chunks.push(chunk));
                req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
                req.on("error", reject);
            });
            try {
                const parsed = JSON.parse(body || "{}") as { path?: string; scope?: string; workspace?: string };
                const result = await handleInstallSkillFromPath({
                    path: parsed.path ?? "",
                    scope: parsed.scope === "workspace" ? "workspace" : "global",
                    workspace: parsed.workspace,
                });
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                const code = message.includes("required") || message.includes("不存在") || message.includes("SKILL.md") || message.includes("目录名") ? 400 : 500;
                res.writeHead(code, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: false, message }));
            }
            return;
        }

        // Proxy API requests to Backend (prefixed with /server-api)
        if (req.url && req.url.startsWith("/server-api")) {
            const options: RequestOptions = {
                hostname: "localhost",
                port: backendPort, // Use discovered port
                path: req.url,
                method: req.method,
                headers: req.headers,
            };

            const proxyReq = httpRequest(options, (proxyRes) => {
                res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
                proxyRes.pipe(res, { end: true });
            });

            proxyReq.on("error", (err) => {
                console.error(`Proxy error to :${backendPort}`, err);
                if (!res.headersSent) {
                    res.writeHead(502, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "Bad Gateway", message: "Failed to connect to backend server" }));
                }
            });

            req.pipe(proxyReq, { end: true });
            return;
        }

        // Serve static files (from package root so npm install works)
        try {
            const staticDir = STATIC_DIR;
            // Normalize URL to remove query parameters and ensuring it starts with /
            const urlPath = req.url?.split("?")[0] || "/";

            // Determine file path
            let filePath = join(staticDir, urlPath === "/" ? "index.html" : urlPath);

            // Check if file exists
            try {
                const stats = await stat(filePath);
                if (stats.isDirectory()) {
                    filePath = join(filePath, "index.html");
                    await stat(filePath); // Check if index.html exists
                }
            } catch {
                // File not found
                // SPA Fallback: serve index.html for non-API requests accepting HTML
                if (req.headers.accept?.includes("text/html") && req.method === "GET") {
                    filePath = join(staticDir, "index.html");
                } else {
                    res.writeHead(404, { "Content-Type": "text/plain" });
                    res.end("Not Found");
                    return;
                }
            }

            // Read and serve file
            const content = await readFile(filePath);
            const ext = extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || "application/octet-stream";

            res.writeHead(200, { "Content-Type": contentType });
            res.end(content);
        } catch (error) {
            console.error("Static file error:", error);
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Internal Server Error");
        }
    });

    // Create WebSocket server
    const wss = new WebSocketServer({ server: httpServer });

    // Handle new connections
    wss.on("connection", (ws, req) => {
        handleConnection(ws, req);
    });

    // Start listening
    await new Promise<void>((resolve) => {
        httpServer.listen(port, () => {
            console.log(`✅ Gateway server listening on ws://localhost:${port}`);
            console.log(`   Health check: http://localhost:${port}/health`);
            resolve();
        });
    });

    // Cleanup function
    const close = async () => {
        console.log("Closing gateway server...");

        // Stop Desktop Server
        if (backendProcess) {
            console.log("Stopping Desktop Server...");
            backendProcess.kill();
        }

        // Close all WebSocket connections
        wss.clients.forEach((client) => {
            client.close();
        });

        // Close WebSocket server
        await new Promise<void>((resolve) => {
            wss.close(() => resolve());
        });

        // Close HTTP server
        await new Promise<void>((resolve) => {
            httpServer.close(() => resolve());
        });

        console.log("Gateway server closed");
    };

    return { httpServer, wss, close };
}
