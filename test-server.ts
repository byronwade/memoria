import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testServer() {
	console.log("🧪 Starting Repo-Forensics MCP Server Test...\n");

	// Spawn the server process
	const serverPath = path.join(__dirname, "dist", "index.js");
	const serverProcess = spawn("node", [serverPath], {
		stdio: ["pipe", "pipe", "pipe"],
		cwd: process.cwd(),
	});

	// Create client transport
	const transport = new StdioClientTransport({
		command: "node",
		args: [serverPath],
	});

	try {
		// Connect to server
		await transport.connect();
		const client = new Client(
			{
				name: "test-client",
				version: "1.0.0",
			},
			{
				capabilities: {},
			}
		);

		await client.connect(transport);

		console.log("✅ Connected to server\n");

		// Test 1: List tools
		console.log("📋 Test 1: Listing available tools...");
		const tools = await client.listTools();
		console.log(`Found ${tools.tools.length} tool(s):`);
		tools.tools.forEach((tool) => {
			console.log(`  - ${tool.name}: ${tool.description}`);
		});
		console.log("");

		// Test 2: Call analyze_file_context with a test file
		console.log("🔍 Test 2: Analyzing file context...");
		const testFile = "src/index.ts"; // Test with our own source file

		try {
			const result = await client.callTool({
				name: "analyze_file_context",
				arguments: {
					path: testFile,
				},
			});

			console.log("✅ Tool executed successfully!\n");
			console.log("📊 Results:");
			if (result.content && result.content.length > 0) {
				const textContent = result.content[0];
				if (typeof textContent === "object" && "text" in textContent) {
					console.log(textContent.text);
				} else {
					console.log(JSON.stringify(result, null, 2));
				}
			} else {
				console.log(JSON.stringify(result, null, 2));
			}
		} catch (error: any) {
			console.error("❌ Error calling tool:", error.message);
			if (error.stack) {
				console.error(error.stack);
			}
		}

		// Cleanup
		await client.close();
		await transport.close();
		serverProcess.kill();

		console.log("\n✅ All tests completed!");
	} catch (error: any) {
		console.error("❌ Test failed:", error.message);
		if (error.stack) {
			console.error(error.stack);
		}
		serverProcess.kill();
		process.exit(1);
	}
}

testServer().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});

