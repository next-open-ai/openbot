#!/usr/bin/env node
import { createBrowserTool } from "./tools/index.js";

async function testDownload() {
    console.log("Testing browser download functionality...\n");

    const browserTool = createBrowserTool();

    console.log("Test 1: Direct URL download");
    console.log("Downloading example.com logo...\n");

    try {
        // Test direct URL download
        const result = await browserTool.execute("test-download-1", {
            action: "download",
            url: "https://www.example.com/favicon.ico"
        });

        console.log("✅ Download result:", JSON.stringify(result, null, 2));

        // Clean up
        await browserTool.execute("test-close", {
            action: "close"
        });

        console.log("\n✅ Download test completed successfully!");
    } catch (error) {
        console.error("\n❌ Download test failed:", error);
        process.exit(1);
    }
}

testDownload();
