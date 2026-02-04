import { WebSocketServer } from "ws";
import { createServer, type Server } from "http";
import { handleConnection } from "./connection-handler.js";

/**
 * Start WebSocket gateway server
 */
export async function startGatewayServer(port: number = 3000): Promise<{
    httpServer: Server;
    wss: WebSocketServer;
    close: () => Promise<void>;
}> {
    console.log(`Starting gateway server on port ${port}...`);

    // Create HTTP server
    const httpServer = createServer((req, res) => {
        // Simple health check endpoint
        if (req.url === "/health") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
            return;
        }

        // Default response
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("OpenBot Gateway Server\n");
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
