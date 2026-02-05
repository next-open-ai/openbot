import { ModelRegistry, AuthStorage } from "@mariozechner/pi-coding-agent";
import { registerBuiltInApiProviders, complete } from "@mariozechner/pi-ai";
import { join } from "node:path";
import { homedir } from "node:os";

registerBuiltInApiProviders();

async function test() {
    const agentDir = join(homedir(), ".freebot", "agent");
    const authStorage = new AuthStorage(join(agentDir, "auth.json"));
    const modelRegistry = new ModelRegistry(authStorage, join(agentDir, "models.json"));

    const model = modelRegistry.find("deepseek", "deepseek-chat");
    if (!model) {
        console.error("Model not found");
        return;
    }

    const key = await authStorage.getApiKey("deepseek");
    console.log("Testing model:", model.id, "with key:", key ? "found" : "not found");

    try {
        const response = await complete(model, {
            messages: [{ role: "user", content: "hello", timestamp: Date.now() }]
        }, {
            apiKey: key || undefined
        });
        console.log("Response:", JSON.stringify(response, null, 2));
    } catch (err: any) {
        console.error("Error:", err);
    }
}

test();
