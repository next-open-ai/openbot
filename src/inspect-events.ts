import { createAgentSession } from "@mariozechner/pi-coding-agent";
import { createBrowserTool } from "./tools/index.js";

async function testEvents() {
    console.log("Creating session...");
    const { session } = await createAgentSession({
        customTools: [createBrowserTool()],
    });

    const modelRegistry = session.modelRegistry;
    const model = await modelRegistry.find("openai", "gpt-4o");
    if (model) {
        await session.setModel(model);
    }

    session.subscribe((event) => {
        console.log("EVENT:", JSON.stringify({ type: event.type, keys: Object.keys(event) }));
        if (event.type === "message_update") {
            const update = event as any;
            console.log("UPDATE EVENT:", JSON.stringify(update.assistantMessageEvent, null, 2));
        }
    });

    console.log("Sending message...");
    await session.sendUserMessage("Say 'HI'");
    console.log("Done.");
}

testEvents().catch(console.error);
