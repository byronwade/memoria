import { describe, it, expect } from "vitest";

// Import from dist to avoid Vitest transformation issues
describe("Auto-Librarian Memory Extraction", () => {
	describe("extractFromCode", () => {
		it("should extract CRITICAL annotations", async () => {
			const { extractFromCode } = await import("../dist/auto-librarian.js");
			const code = "// CRITICAL: This must never be modified without security review\nfunction processPayment() {}";
			const memories = extractFromCode(code, "payment.ts");

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].importance).toBe("critical");
			expect(memories[0].memoryType).toBe("warning");
		});

		it("should extract WARNING annotations", async () => {
			const { extractFromCode } = await import("../dist/auto-librarian.js");
			const code = "// WARNING: This function has side effects on global state\nfunction updateState() {}";
			const memories = extractFromCode(code, "state.ts");

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].importance).toBe("high");
		});

		it("should extract HACK annotations", async () => {
			const { extractFromCode } = await import("../dist/auto-librarian.js");
			const code = "// HACK: Workaround for Safari bug in WebSocket handling\nsetTimeout(() => resolve(), 0);";
			const memories = extractFromCode(code, "websocket.ts");

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].memoryType).toBe("context");
			expect(memories[0].importance).toBe("high");
		});

		it("should extract TODO annotations", async () => {
			const { extractFromCode } = await import("../dist/auto-librarian.js");
			const code = "// TODO: Refactor this to use async/await pattern\nfunction legacyFetch() {}";
			const memories = extractFromCode(code, "fetch.ts");

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].memoryType).toBe("todo");
		});

		it("should extract IMPORTANT annotations", async () => {
			const { extractFromCode } = await import("../dist/auto-librarian.js");
			const code = "// IMPORTANT: This order of operations matters for race condition prevention\nawait lockResource();";
			const memories = extractFromCode(code, "process.ts");

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].importance).toBe("high");
		});

		it("should return empty for code without annotations", async () => {
			const { extractFromCode } = await import("../dist/auto-librarian.js");
			const code = "function add(a, b) { return a + b; }";
			const memories = extractFromCode(code, "math.ts");

			expect(memories).toHaveLength(0);
		});

		it("should include file path in linkedFiles", async () => {
			const { extractFromCode } = await import("../dist/auto-librarian.js");
			const code = "// IMPORTANT: Keep this synchronized with the API schema";
			const memories = extractFromCode(code, "schema.ts");

			expect(memories[0].linkedFiles).toContain("schema.ts");
		});
	});

	describe("extractFromCommitMessage", () => {
		it("should extract bug fix explanations", async () => {
			const { extractFromCommitMessage } = await import("../dist/auto-librarian.js");
			const message = "fix: Resolve race condition in authentication flow\n\nThis fixes a bug where multiple login attempts could cause token corruption.";
			const memories = extractFromCommitMessage(message, "abc123", ["auth.ts"]);

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].memoryType).toBe("lesson");
		});

		it("should extract security-related commits", async () => {
			const { extractFromCommitMessage } = await import("../dist/auto-librarian.js");
			const message = "security: Patch XSS vulnerability in user input handling was not sanitized";
			const memories = extractFromCommitMessage(message, "def456", ["input.ts"]);

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].importance).toBe("critical");
		});

		it("should extract revert commits", async () => {
			const { extractFromCommitMessage } = await import("../dist/auto-librarian.js");
			const message = "revert: Rollback payment processor change due to failed transactions";
			const memories = extractFromCommitMessage(message, "ghi789", ["payment.ts"]);

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].importance).toBe("high");
		});

		it("should extract breaking changes", async () => {
			const { extractFromCommitMessage } = await import("../dist/auto-librarian.js");
			const message = "breaking change: API response format changed to JSON:API spec for all clients";
			const memories = extractFromCommitMessage(message, "jkl012", ["api.ts"]);

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].importance).toBe("critical");
		});
	});

	describe("scanFile", () => {
		it("should filter by minimum confidence", async () => {
			const { scanFile } = await import("../dist/auto-librarian.js");
			const code = "// TODO: minor cleanup needed\n// CRITICAL: Never remove this validation - prevents SQL injection";

			const highConfidence = scanFile(code, "file.ts", 70);
			const lowConfidence = scanFile(code, "file.ts", 30);

			expect(highConfidence.length).toBeLessThanOrEqual(lowConfidence.length);
		});
	});
});
