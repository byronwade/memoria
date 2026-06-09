import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import createServer, { cache } from "../src/index.js";

/**
 * MCP PROTOCOL COMPLIANCE
 *
 * These tests drive the real MCP `Server` (built by `createServer`) through an
 * actual MCP `Client` over an in-memory transport. Unlike the older tests that
 * call engine functions directly, these exercise the protocol surface:
 * tool/prompt/resource registration, request routing, the JSON shapes returned,
 * and the error responses the AI client will actually receive.
 *
 * This is the layer that would catch regressions like a tool being dropped from
 * the manifest, a required field disappearing from an input schema, or an error
 * path returning a malformed result.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

// A real, tracked file inside this git repo — safe to analyze deterministically.
const REAL_FILE = join(projectRoot, "src", "index.ts");

interface Harness {
	client: Client;
	close: () => Promise<void>;
}

async function connect(): Promise<Harness> {
	const server = createServer();
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();
	const client = new Client(
		{ name: "test-client", version: "1.0.0" },
		{ capabilities: {} },
	);
	await Promise.all([
		server.connect(serverTransport),
		client.connect(clientTransport),
	]);
	return {
		client,
		close: async () => {
			await client.close();
			await server.close();
		},
	};
}

/** Extract concatenated text from a tool-call result's content blocks. */
function textOf(result: any): string {
	return (result.content as Array<{ type: string; text?: string }>)
		.filter((c) => c.type === "text")
		.map((c) => c.text ?? "")
		.join("\n");
}

describe("MCP Protocol Compliance", () => {
	let harness: Harness;

	beforeEach(async () => {
		cache.clear();
		harness = await connect();
	});

	afterEach(async () => {
		await harness.close();
	});

	describe("tools/list", () => {
		it("registers exactly the documented tools", async () => {
			const { tools } = await harness.client.listTools();
			const names = tools.map((t) => t.name).sort();
			expect(names).toEqual(
				[
					"analyze_file",
					"ask_history",
					"extract_memories",
					"get_context",
					"save_lesson",
					"search_memories",
				].sort(),
			);
		});

		it("gives every tool a description and an object input schema", async () => {
			const { tools } = await harness.client.listTools();
			for (const tool of tools) {
				expect(typeof tool.description).toBe("string");
				expect(tool.description!.length).toBeGreaterThan(0);
				expect(tool.inputSchema).toBeDefined();
				expect(tool.inputSchema.type).toBe("object");
			}
		});

		it("declares the correct required fields per tool", async () => {
			const { tools } = await harness.client.listTools();
			const byName = Object.fromEntries(tools.map((t) => [t.name, t]));

			expect(byName.analyze_file.inputSchema.required).toEqual(["path"]);
			expect(byName.ask_history.inputSchema.required).toEqual(["query"]);
			expect(byName.get_context.inputSchema.required).toEqual(["path"]);
			expect(byName.search_memories.inputSchema.required).toEqual(["query"]);
			expect(byName.extract_memories.inputSchema.required).toEqual(["path"]);
			// save_lesson needs identity + content to persist a memory
			expect(byName.save_lesson.inputSchema.required).toEqual(
				expect.arrayContaining(["context", "orgId", "userId"]),
			);
		});

		it("constrains ask_history.searchType to the supported enum", async () => {
			const { tools } = await harness.client.listTools();
			const askHistory = tools.find((t) => t.name === "ask_history")!;
			const props = askHistory.inputSchema.properties as Record<string, any>;
			expect(props.searchType.enum).toEqual(["message", "diff", "both"]);
		});

		it("marks read-only tools with readOnlyHint", async () => {
			const { tools } = await harness.client.listTools();
			const analyze = tools.find((t) => t.name === "analyze_file")!;
			// annotations are passed through verbatim by the SDK
			expect((analyze as any).annotations?.readOnlyHint).toBe(true);
		});
	});

	describe("tools/call: analyze_file", () => {
		it("returns a forensic report for a real file", async () => {
			const result = await harness.client.callTool({
				name: "analyze_file",
				arguments: { path: REAL_FILE },
			});
			const text = textOf(result);
			expect(text).toContain("index.ts");
			expect(text).toContain("RISK:");
			expect(result.isError).toBeFalsy();
		}, 30000);

		it("fails loudly with a retry instruction for a non-existent path", async () => {
			const result = await harness.client.callTool({
				name: "analyze_file",
				arguments: { path: join(projectRoot, "does", "not", "exist.ts") },
			});
			expect(result.isError).toBe(true);
			const text = textOf(result);
			expect(text).toContain("File not found");
			expect(text).toContain("ABSOLUTE PATH");
		});

		it("resolves relative paths and reports them as missing when unresolved", async () => {
			// A bare relative path resolves against the server's cwd, not the
			// project, so the AI must be told to retry with an absolute path.
			const result = await harness.client.callTool({
				name: "analyze_file",
				arguments: { path: "totally-not-a-real-relative-file.xyz" },
			});
			expect(result.isError).toBe(true);
			expect(textOf(result)).toContain("File not found");
		});
	});

	describe("tools/call: ask_history", () => {
		it("returns a structured history report for a keyword", async () => {
			const result = await harness.client.callTool({
				name: "ask_history",
				arguments: { query: "fix", limit: 5 },
			});
			expect(result.isError).toBeFalsy();
			expect(textOf(result)).toContain("History Search");
		});

		it("rejects an empty query that is not a line-range search", async () => {
			const result = await harness.client.callTool({
				name: "ask_history",
				arguments: { query: "   " },
			});
			expect(result.isError).toBe(true);
			expect(textOf(result)).toContain("Query is required");
		});

		it("rejects a line-range search without a path", async () => {
			const result = await harness.client.callTool({
				name: "ask_history",
				arguments: { query: "", startLine: 10, endLine: 20 },
			});
			expect(result.isError).toBe(true);
			expect(textOf(result)).toContain("Line-range search requires a file path");
		});

		it("rejects an inverted line range", async () => {
			const result = await harness.client.callTool({
				name: "ask_history",
				arguments: { query: "", path: REAL_FILE, startLine: 50, endLine: 10 },
			});
			expect(result.isError).toBe(true);
			expect(textOf(result)).toContain("Invalid line range");
		});

		it("rejects a path that does not exist", async () => {
			const result = await harness.client.callTool({
				name: "ask_history",
				arguments: { query: "fix", path: join(projectRoot, "ghost.ts") },
			});
			expect(result.isError).toBe(true);
			expect(textOf(result)).toContain("Path not found");
		});
	});

	describe("tools/call: save_lesson", () => {
		it("rejects an empty context before touching the cloud", async () => {
			const result = await harness.client.callTool({
				name: "save_lesson",
				arguments: { context: "  ", orgId: "org", userId: "user" },
			});
			expect(result.isError).toBe(true);
			expect(textOf(result)).toContain("Context is required");
		});

		it("fails with an auth error when no cloud token is configured", async () => {
			const result = await harness.client.callTool({
				name: "save_lesson",
				arguments: {
					context: "Always run migrations before deploy",
					orgId: "org",
					userId: "user",
				},
			});
			// Without a configured token the save cannot proceed; the handler
			// must surface that as an error rather than silently succeeding.
			expect(result.isError).toBe(true);
			expect(textOf(result)).toContain("Save Failed");
		});
	});

	describe("tools/call: error handling", () => {
		it("throws for an unknown tool name", async () => {
			await expect(
				harness.client.callTool({
					name: "this_tool_does_not_exist",
					arguments: {},
				}),
			).rejects.toThrow();
		});
	});

	describe("prompts", () => {
		it("lists the documented prompts", async () => {
			const { prompts } = await harness.client.listPrompts();
			const names = prompts.map((p) => p.name).sort();
			expect(names).toEqual(
				["analyze_before_edit", "understand_code_history"].sort(),
			);
		});

		it("marks analyze_before_edit's path argument as required", async () => {
			const { prompts } = await harness.client.listPrompts();
			const prompt = prompts.find((p) => p.name === "analyze_before_edit")!;
			const pathArg = prompt.arguments?.find((a) => a.name === "path");
			expect(pathArg?.required).toBe(true);
		});

		it("renders analyze_before_edit with the supplied path", async () => {
			const result = await harness.client.getPrompt({
				name: "analyze_before_edit",
				arguments: { path: "/abs/foo.ts" },
			});
			expect(result.messages[0].role).toBe("user");
			expect((result.messages[0].content as any).text).toContain("/abs/foo.ts");
		});

		it("scopes understand_code_history when a path is provided", async () => {
			const result = await harness.client.getPrompt({
				name: "understand_code_history",
				arguments: { query: "race condition", path: "/abs/bar.ts" },
			});
			const text = (result.messages[0].content as any).text;
			expect(text).toContain("race condition");
			expect(text).toContain("/abs/bar.ts");
		});

		it("throws for an unknown prompt", async () => {
			await expect(
				harness.client.getPrompt({ name: "nope", arguments: {} }),
			).rejects.toThrow();
		});
	});

	describe("resources", () => {
		it("lists the defaults resource", async () => {
			const { resources } = await harness.client.listResources();
			const uris = resources.map((r) => r.uri);
			expect(uris).toContain("memoria://defaults");
		});

		it("reads the defaults resource as valid JSON with expected shape", async () => {
			const result = await harness.client.readResource({
				uri: "memoria://defaults",
			});
			const block = result.contents[0] as { mimeType?: string; text?: string };
			expect(block.mimeType).toBe("application/json");
			const parsed = JSON.parse(block.text ?? "{}");
			expect(parsed.thresholds.couplingPercent).toBe(15);
			expect(parsed.riskWeights.volatility).toBe(0.35);
		});

		it("throws when reading an unknown resource uri", async () => {
			await expect(
				harness.client.readResource({ uri: "memoria://unknown" }),
			).rejects.toThrow();
		});
	});
});
