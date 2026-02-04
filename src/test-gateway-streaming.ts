import WebSocket from "ws";

async function testGateway() {
    const ws = new WebSocket("ws://localhost:3001");

    ws.on("open", () => {
        console.log("Connected to gateway");

        // 1. Connect
        ws.send(JSON.stringify({
            jsonrpc: "2.0",
            id: "connect-1",
            method: "connect",
            params: {
                sessionId: "test-session-" + Date.now()
            }
        }));
    });

    ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        console.log("Received:", JSON.stringify(msg, null, 2));

        if (msg.id === "connect-1") {
            // 2. Chat
            console.log("Sending agent.chat...");
            ws.send(JSON.stringify({
                jsonrpc: "2.0",
                id: "chat-1",
                method: "agent.chat",
                params: {
                    message: "Tell me a short poem about coding."
                }
            }));
        }

        if (msg.method === "agent.chunk") {
            process.stdout.write(msg.params.text);
        }
    });

    ws.on("error", console.error);
    ws.on("close", () => console.log("Disconnected"));
}

testGateway().catch(console.error);
