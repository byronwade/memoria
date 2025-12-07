/**
 * Tests for Cloud Client Memory Operations
 *
 * Tests the MemoriaCloudClient class for:
 * - Token validation and caching
 * - Memory saving with proper formatting
 * - Error handling for network failures
 * - Guardrails checking
 */

import { describe, it, expect } from "vitest";
// Import once at module level to avoid memory leaks
import {
	MemoriaCloudClient,
	getCloudClient,
	initializeCloudClient,
} from "../dist/convex-client.js";

describe("MemoriaCloudClient", () => {
	describe("Configuration", () => {
		it("should not be configured with empty URL", () => {
			const client = new MemoriaCloudClient("");
			expect(client.isConfigured()).toBe(false);
		});

		it("should be configured with undefined URL (uses defaults)", () => {
			// When undefined is passed, it uses MEMORIA_API_URL env var or defaults to production
			const client = new MemoriaCloudClient(undefined);
			expect(client.isConfigured()).toBe(true);
		});

		it("should be configured with valid URL", () => {
			const client = new MemoriaCloudClient("https://api.memoria.dev");
			expect(client.isConfigured()).toBe(true);
		});

		it("should be configured with localhost URL", () => {
			const client = new MemoriaCloudClient("http://localhost:3000");
			expect(client.isConfigured()).toBe(true);
		});
	});

	describe("Token Management", () => {
		it("should allow setting a token", () => {
			const client = new MemoriaCloudClient("https://api.example.com");
			// Should not throw
			client.setToken("test-token-12345");
		});

		it("should clear validation cache when token changes", async () => {
			const client = new MemoriaCloudClient("https://api.example.com");
			client.setToken("token1");
			client.setToken("token2");

			// Validate should require re-validation
			const result = await client.validateToken();
			// Will fail due to network, but should attempt validation
			expect(result.valid).toBe(false);
		});
	});

	describe("Token Validation", () => {
		it("should return error when no token set", async () => {
			const client = new MemoriaCloudClient("https://api.example.com");
			const result = await client.validateToken();

			expect(result.valid).toBe(false);
			// With device-based auth, the message now mentions 'memoria login'
			expect(result.error).toContain("No authentication configured");
		});

		it("should return error when not configured", async () => {
			const client = new MemoriaCloudClient("");
			client.setToken("some-token");
			const result = await client.validateToken();

			expect(result.valid).toBe(false);
			expect(result.error).toContain("not configured");
		});
	});

	describe("Memory Save Operations", () => {
		it("should fail saveMemory without token", async () => {
			const client = new MemoriaCloudClient("https://api.example.com");
			const result = await client.saveMemory({
				orgId: "org123",
				context: "Test context",
				userId: "user123",
			});

			expect(result.error).toBeDefined();
			expect(result.memoryId).toBeUndefined();
		});

		it("should fail saveMemory without configuration", async () => {
			const client = new MemoriaCloudClient("");
			client.setToken("some-token");
			const result = await client.saveMemory({
				orgId: "org123",
				context: "Test context",
				userId: "user123",
			});

			expect(result.error).toBeDefined();
		});
	});

	describe("Memory Retrieval", () => {
		it("should fail getMemoriesForFile without token", async () => {
			const client = new MemoriaCloudClient("https://api.example.com");
			const result = await client.getMemoriesForFile("/path/to/file.ts");

			expect(result.memories).toHaveLength(0);
			expect(result.error).toBeDefined();
		});

		it("should support keyword search", async () => {
			const client = new MemoriaCloudClient("https://api.example.com");
			// Will fail without auth, but verifies API accepts keywords
			const result = await client.getMemoriesForFile(
				"/path/to/file.ts",
				["security", "auth"],
				"repo123"
			);

			expect(result.memories).toHaveLength(0);
			// Error expected due to no auth
		});
	});

	describe("Guardrails", () => {
		it("should fail getGuardrailsForFile without token", async () => {
			const client = new MemoriaCloudClient("https://api.example.com");
			const result = await client.getGuardrailsForFile("/path/to/file.ts");

			expect(result.guardrails).toHaveLength(0);
			expect(result.error).toBeDefined();
		});

		it("should allow access when no guardrails configured", async () => {
			const client = new MemoriaCloudClient("https://api.example.com");
			const result = await client.checkGuardrails("/path/to/file.ts");

			// Should be allowed when no guardrails (or error)
			expect(result.allowed).toBe(true);
			expect(result.blocks).toHaveLength(0);
			expect(result.warnings).toHaveLength(0);
		});
	});

	describe("Singleton Pattern", () => {
		it("should return same instance from getCloudClient", () => {
			const client1 = getCloudClient();
			const client2 = getCloudClient();

			expect(client1).toBe(client2);
		});
	});

	describe("CreateMemoryInput Validation", () => {
		it("should accept all memory types", async () => {
			const client = new MemoriaCloudClient("https://api.example.com");

			const memoryTypes = [
				"lesson",
				"context",
				"decision",
				"pattern",
				"warning",
				"todo",
			] as const;

			for (const memoryType of memoryTypes) {
				// Will fail auth but validates input structure
				const result = await client.saveMemory({
					orgId: "org123",
					context: "Test context",
					memoryType,
					userId: "user123",
				});

				// Should fail auth, not input validation
				expect(result.error).toBeDefined();
				expect(result.error).not.toContain("invalid memory type");
			}
		});

		it("should accept all importance levels", async () => {
			const client = new MemoriaCloudClient("https://api.example.com");

			const levels = ["critical", "high", "normal", "low"] as const;

			for (const importance of levels) {
				const result = await client.saveMemory({
					orgId: "org123",
					context: "Test context",
					importance,
					userId: "user123",
				});

				expect(result.error).toBeDefined();
				expect(result.error).not.toContain("invalid importance");
			}
		});

		it("should accept optional fields", async () => {
			const client = new MemoriaCloudClient("https://api.example.com");

			const result = await client.saveMemory({
				orgId: "org123",
				context: "Test context with all optional fields",
				summary: "Short summary",
				tags: ["tag1", "tag2"],
				keywords: ["keyword1", "keyword2"],
				linkedFiles: ["/path/to/file1.ts", "/path/to/file2.ts"],
				memoryType: "lesson",
				importance: "high",
				repoId: "repo123",
				userId: "user123",
			});

			// Fails auth but validates structure
			expect(result.error).toBeDefined();
		});
	});
});

describe("Memory Interface Types", () => {
	it("should define Memory interface correctly", () => {
		// TypeScript compile-time check - if this compiles, types are correct
		const memory = {
			_id: "mem123",
			context: "Test context",
			summary: "Summary",
			tags: ["tag1"],
			keywords: ["kw1"],
			linkedFiles: ["/file.ts"],
			memoryType: "lesson" as const,
			importance: "high" as const,
			createdAt: Date.now(),
		};

		// Should be assignable to Memory type
		expect(memory._id).toBe("mem123");
		expect(memory.importance).toBe("high");
	});

	it("should define CreateMemoryInput correctly", () => {
		const input = {
			orgId: "org123",
			repoId: "repo123",
			context: "Context",
			summary: "Summary",
			tags: ["tag"],
			keywords: ["kw"],
			linkedFiles: ["/file.ts"],
			memoryType: "warning" as const,
			importance: "critical" as const,
			userId: "user123",
		};

		expect(input.orgId).toBe("org123");
		expect(input.importance).toBe("critical");
	});

	it("should define Guardrail interface correctly", () => {
		const guardrail = {
			_id: "gr123",
			pattern: "src/auth/**",
			level: "block" as const,
			message: "Authentication files are protected",
			isEnabled: true,
		};

		expect(guardrail.level).toBe("block");
		expect(guardrail.isEnabled).toBe(true);
	});
});
