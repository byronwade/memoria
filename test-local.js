#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function test() {
  console.log("🧪 Testing Memoria MCP Server...\n");

  const transport = new StdioClientTransport({
    command: "node",
    args: [join(__dirname, "dist/index.js")],
  });

  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(transport);

  // List available tools
  const tools = await client.listTools();
  console.log("📦 Available tools:", tools.tools.map(t => t.name).join(", "));

  // Test analyze_file on tests/cache.test.ts
  const testFile = join(__dirname, "tests/cache.test.ts");
  console.log(`\n🔍 Analyzing: ${testFile}\n`);

  const result = await client.callTool({
    name: "analyze_file",
    arguments: { path: testFile },
  });

  console.log("─".repeat(60));
  console.log(result.content[0].text);
  console.log("─".repeat(60));

  await client.close();
  console.log("\n✅ Test complete!");
}

test().catch(console.error);
