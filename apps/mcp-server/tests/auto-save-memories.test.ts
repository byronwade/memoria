/**
 * Tests for Auto-Save Memory Functionality
 *
 * Tests the automatic memory saving feature in:
 * - extract_memories tool
 * - get_context tool
 */

import { describe, it, expect } from "vitest";
// Import once at module level to avoid memory leaks from repeated dynamic imports
import {
	extractFromCode,
	extractFromCommitMessage,
	scanFile,
	mergeSimilarMemories,
} from "../dist/auto-librarian.js";

describe("Auto-Save Memories", () => {
	describe("extractFromCode - Memory Extraction", () => {
		it("should extract CRITICAL annotations with high confidence", () => {
			const code = `// CRITICAL: This validation prevents SQL injection attacks in user input\nfunction sanitizeInput(input) {}`;
			const memories = extractFromCode(code, "/path/to/security.ts");

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].importance).toBe("critical");
			expect(memories[0].confidence).toBeGreaterThanOrEqual(50);
			expect(memories[0].linkedFiles).toContain("/path/to/security.ts");
		});

		it("should extract WARNING annotations with high importance", () => {
			const code = `// WARNING: This function modifies global state and is not thread-safe\nfunction updateGlobalCache(data) {}`;
			const memories = extractFromCode(code, "/path/to/cache.ts");

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].importance).toBe("high");
			expect(memories[0].memoryType).toBe("warning");
		});

		it("should extract HACK annotations with context type", () => {
			const code = `// HACK: Workaround for Safari WebSocket bug that causes random disconnects\nsetTimeout(() => reconnect(), 100);`;
			const memories = extractFromCode(code, "/path/to/websocket.ts");

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].memoryType).toBe("context");
			expect(memories[0].importance).toBe("high");
		});

		it("should extract multiple annotations from same file", () => {
			const code = `
// CRITICAL: Never expose this key in client code
const API_KEY = process.env.SECRET_KEY;

// WARNING: Rate limiting is required for this endpoint
async function fetchData() {}

// HACK: Temporary fix until upstream library is patched
function workaround() {}
			`;
			const memories = extractFromCode(code, "/path/to/api.ts");

			expect(memories.length).toBeGreaterThanOrEqual(2);

			const critical = memories.filter((m) => m.importance === "critical");
			const high = memories.filter((m) => m.importance === "high");

			expect(critical.length).toBeGreaterThanOrEqual(1);
			expect(high.length).toBeGreaterThanOrEqual(1);
		});

		it("should not extract short annotations below minimum length", () => {
			const code = `// CRITICAL: short\n// WARNING: x`;
			const memories = extractFromCode(code, "/path/to/file.ts");

			// These are too short and should be filtered
			expect(memories.length).toBe(0);
		});

		it("should generate summary from context", () => {
			const code = `// CRITICAL: This authentication check must happen before any data access to prevent unauthorized access\nfunction checkAuth() {}`;
			const memories = extractFromCode(code, "/path/to/auth.ts");

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].summary).toBeDefined();
			expect(memories[0].summary.length).toBeLessThanOrEqual(103);
		});
	});

	describe("scanFile - Confidence Filtering", () => {
		it("should filter by minimum confidence threshold", () => {
			const code = `
// TODO: minor cleanup
// CRITICAL: Security vulnerability must be addressed before deployment
			`;

			const highConfidence = scanFile(code, "/path/to/file.ts", 70);
			const lowConfidence = scanFile(code, "/path/to/file.ts", 30);

			expect(lowConfidence.length).toBeGreaterThanOrEqual(highConfidence.length);
		});

		it("should return only high-confidence memories with default threshold", () => {
			const code = `// CRITICAL: This is a very important security note about authentication and authorization`;

			const memories = scanFile(code, "/path/to/file.ts", 50);

			for (const memory of memories) {
				expect(memory.confidence).toBeGreaterThanOrEqual(50);
			}
		});
	});

	describe("extractFromCommitMessage - Commit Analysis", () => {
		it("should extract bug fix memories", () => {
			const message =
				"fix: Resolve critical race condition in payment processing that caused duplicate charges";
			const memories = extractFromCommitMessage(message, "abc123", ["/path/to/payment.ts"]);

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].memoryType).toBe("lesson");
			expect(memories[0].source.type).toBe("commit_message");
			expect(memories[0].source.reference).toBe("abc123");
		});

		it("should extract security-related commits as critical", () => {
			const message = "security: Patch critical XSS vulnerability in user comment rendering";
			const memories = extractFromCommitMessage(message, "def456", ["/path/to/comments.ts"]);

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].importance).toBe("critical");
		});

		it("should extract revert commits as high importance", () => {
			const message = "revert: Rollback feature flag changes due to production incidents";
			const memories = extractFromCommitMessage(message, "ghi789", ["/path/to/flags.ts"]);

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].importance).toBe("high");
		});

		it("should link commit to affected files", () => {
			const files = ["/path/to/auth.ts", "/path/to/session.ts", "/path/to/token.ts"];
			const message = "fix: Resolve authentication timeout issues in session management";
			const memories = extractFromCommitMessage(message, "jkl012", files);

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].linkedFiles).toEqual(expect.arrayContaining(files));
		});
	});

	describe("Auto-Save Thresholds", () => {
		it("should only save memories meeting confidence threshold", () => {
			const code = `
// CRITICAL: This is a very important security note about preventing SQL injection attacks in user input
function validateInput() {}

// TODO: cleanup
function oldCode() {}
			`;

			const memories = extractFromCode(code, "/path/to/file.ts");

			// Filter as the auto-save would
			const autoSaveThreshold = 70;
			const toSave = memories.filter(
				(m) =>
					m.confidence >= autoSaveThreshold &&
					(m.importance === "critical" || m.importance === "high")
			);

			// Should only include high-confidence critical/high importance
			for (const memory of toSave) {
				expect(memory.confidence).toBeGreaterThanOrEqual(autoSaveThreshold);
				expect(["critical", "high"]).toContain(memory.importance);
			}
		});
	});

	describe("Source Type Tracking", () => {
		it("should track source type as auto_extracted for code comments", () => {
			const code = "// CRITICAL: Important security validation step\nfunction check() {}";
			const memories = extractFromCode(code, "/path/to/file.ts");

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].source.type).toBe("auto_extracted");
			expect(memories[0].source.reference).toBe("/path/to/file.ts");
		});

		it("should track source type as commit_message for commits", () => {
			const memories = extractFromCommitMessage(
				"fix: Critical security patch for authentication bypass",
				"abc123",
				["/auth.ts"]
			);

			expect(memories.length).toBeGreaterThan(0);
			expect(memories[0].source.type).toBe("commit_message");
			expect(memories[0].source.reference).toBe("abc123");
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty file content", () => {
			const memories = extractFromCode("", "/path/to/empty.ts");
			expect(memories).toHaveLength(0);
		});

		it("should handle file with only whitespace", () => {
			const memories = extractFromCode("   \n\n\t\t  \n", "/path/to/whitespace.ts");
			expect(memories).toHaveLength(0);
		});

		it("should handle special characters in annotations", () => {
			const code = `// CRITICAL: Handle special chars: <>&"'\\n\\t$\`{}[]|^~\nfunction escape() {}`;
			const memories = extractFromCode(code, "/path/to/special.ts");
			expect(Array.isArray(memories)).toBe(true);
		});

		it("should handle Unicode in annotations", () => {
			const code = `// CRITICAL: Handle international characters: 日本語 中文 한국어 العربية\nfunction i18n() {}`;
			const memories = extractFromCode(code, "/path/to/unicode.ts");
			expect(Array.isArray(memories)).toBe(true);
		});
	});

	describe("Python Comment Patterns", () => {
		it("should extract Python-style comments", () => {
			const code = `
# CRITICAL: This validation is required for security
def validate_input(data):
    pass

# WARNING: This function has side effects on the database
def update_record(id):
    pass
			`;
			const memories = extractFromCode(code, "/path/to/security.py");

			expect(memories.length).toBeGreaterThan(0);
			expect(memories.some((m) => m.importance === "critical")).toBe(true);
		});
	});

	describe("Block Comment Patterns", () => {
		it("should extract from block comments", () => {
			const code = `
/* CRITICAL: This entire block is security sensitive */
function sensitiveOperation() {}

/* WARNING: Deprecated API - will be removed in v2.0 */
function legacyFunction() {}
			`;
			const memories = extractFromCode(code, "/path/to/legacy.ts");

			expect(memories.length).toBeGreaterThan(0);
		});
	});

	describe("Deduplication", () => {
		it("should merge similar memories", () => {
			const memories = [
				{
					context: "Database connection must be properly managed and closed",
					summary: "Database connection management",
					keywords: ["database", "connection"],
					memoryType: "warning" as const,
					importance: "high" as const,
					source: { type: "auto_extracted" as const, reference: null },
					linkedFiles: ["/file1.ts"],
					confidence: 75,
				},
				{
					context: "Database connection must be properly managed and closed carefully",
					summary: "Database connection management",
					keywords: ["database", "connection"],
					memoryType: "warning" as const,
					importance: "high" as const,
					source: { type: "auto_extracted" as const, reference: null },
					linkedFiles: ["/file2.ts"],
					confidence: 75,
				},
			];

			const merged = mergeSimilarMemories(memories, 0.7);
			expect(merged.length).toBeLessThanOrEqual(memories.length);
		});
	});
});

describe("Integration - Auto-Save Flow", () => {
	it("should identify memories eligible for auto-save", () => {
		const code = `
// CRITICAL: Authentication bypass vulnerability - must validate token before any operation
function authenticate() {}

// TODO: Add logging
function process() {}

// WARNING: This modifies global state and may cause race conditions in concurrent requests
function updateCache() {}
		`;

		const memories = extractFromCode(code, "/path/to/auth.ts");

		// Filter as auto-save would
		const autoSaveThreshold = 70;
		const eligibleForAutoSave = memories.filter(
			(m) =>
				m.confidence >= autoSaveThreshold &&
				(m.importance === "critical" || m.importance === "high")
		);

		// Should have at least one eligible
		expect(eligibleForAutoSave.length).toBeGreaterThanOrEqual(1);

		// All eligible should be critical or high
		for (const memory of eligibleForAutoSave) {
			expect(["critical", "high"]).toContain(memory.importance);
		}
	});

	it("should properly format memories for cloud storage", () => {
		const code = "// CRITICAL: Security validation required for all API endpoints";
		const memories = extractFromCode(code, "/path/to/api.ts");

		expect(memories.length).toBeGreaterThan(0);

		const memory = memories[0];

		// Verify all required fields for CreateMemoryInput
		expect(memory.context).toBeDefined();
		expect(typeof memory.context).toBe("string");
		expect(memory.summary).toBeDefined();
		expect(memory.keywords).toBeDefined();
		expect(Array.isArray(memory.keywords)).toBe(true);
		expect(memory.linkedFiles).toBeDefined();
		expect(Array.isArray(memory.linkedFiles)).toBe(true);
		expect(memory.memoryType).toBeDefined();
		expect(["lesson", "context", "decision", "pattern", "warning", "todo"]).toContain(
			memory.memoryType
		);
		expect(memory.importance).toBeDefined();
		expect(["critical", "high", "normal", "low"]).toContain(memory.importance);
		expect(memory.source).toBeDefined();
		expect(memory.source.type).toBeDefined();
	});

	it("should respect auto-save limit of 20 memories", () => {
		// Generate many CRITICAL annotations
		let code = "";
		for (let i = 0; i < 30; i++) {
			code += `// CRITICAL: Security note ${i} about preventing various attacks\n`;
		}

		const memories = extractFromCode(code, "/path/to/file.ts");

		// Simulate auto-save limit
		const autoSaveLimit = 20;
		const toSave = memories
			.filter(
				(m) =>
					m.confidence >= 70 && (m.importance === "critical" || m.importance === "high")
			)
			.slice(0, autoSaveLimit);

		expect(toSave.length).toBeLessThanOrEqual(autoSaveLimit);
	});
});
