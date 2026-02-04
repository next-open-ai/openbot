#!/usr/bin/env node
import { createAgentSession } from "@mariozechner/pi-coding-agent";
import { createBrowserTool } from "./tools/index.js";

async function testToolRegistration() {
    console.log("Creating agent session with browser tool...\n");

    const { session } = await createAgentSession({
        customTools: [createBrowserTool()]
    });

    console.log("=== Agent State ===");
    console.log("Tools count:", session.agent.state.tools.length);
    console.log("\nTool names:");
    session.agent.state.tools.forEach((tool: any, i: number) => {
        console.log(`  ${i + 1}. ${tool.name} - ${tool.label || '(no label)'}`);
    });

    console.log("\n=== System Prompt Preview ===");
    const systemPrompt = session.agent.state.systemPrompt;
    console.log("Length:", systemPrompt.length, "characters");
    console.log("First 500 chars:", systemPrompt.substring(0, 500));

    // Check if browser is mentioned
    const hasBrowser = systemPrompt.toLowerCase().includes('browser');
    console.log("\nContains 'browser':", hasBrowser);

    console.log("\n=== All Tools Registry ===");
    const allTools = session.getAllTools();
    console.log("Total tools:", allTools.length);
    allTools.forEach((tool: any) => console.log(`  - ${tool.name}`));
}

testToolRegistration().catch(console.error);
