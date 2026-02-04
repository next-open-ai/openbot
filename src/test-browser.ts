#!/usr/bin/env node
import { createBrowserTool } from "./tools/index.js";

async function testBrowserTool() {
    console.log("Testing browser tool...\n");

    const browserTool = createBrowserTool();

    console.log("Tool name:", browserTool.name);
    console.log("Tool label:", browserTool.label);
    console.log("Tool description:", browserTool.description);
    console.log("\nTesting navigate action...");

    try {
        const result = await browserTool.execute("test-1", {
            action: "navigate",
            url: "https://example.com"
        });

        console.log("Navigate result:", JSON.stringify(result, null, 2));

        console.log("\nTesting snapshot action...");
        const snapshotResult = await browserTool.execute("test-2", {
            action: "snapshot",
            interactive: true
        });

        console.log("Snapshot result (truncated):");
        const firstContent = snapshotResult.content[0];
        if (firstContent && 'text' in firstContent) {
            console.log(firstContent.text.substring(0, 500) + "...");
        }

        console.log("\nTesting close action...");
        await browserTool.execute("test-3", {
            action: "close"
        });

        console.log("\n✅ Browser tool test completed successfully!");
    } catch (error) {
        console.error("\n❌ Browser tool test failed:", error);
        process.exit(1);
    }
}

testBrowserTool();
