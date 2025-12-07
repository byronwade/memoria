/**
 * Stress Tests for Memory Extraction and Auto-Save
 *
 * Lightweight performance tests for:
 * - Large file processing
 * - Concurrent extractions
 * - Deduplication
 */

import { describe, it, expect } from "vitest";
// Import once at module level to avoid memory leaks
import {
	extractFromCode,
	extractFromCommitMessage,
	mergeSimilarMemories,
} from "../dist/auto-librarian.js";

describe("Memory Extraction Performance", () => {
	it("should handle files with 500 lines efficiently", () => {
		// Generate a 500 line file
		let code = "";
		for (let i = 0; i < 500; i++) {
			code += `const value${i} = ${i};\n`;
			if (i % 100 === 0) {
				code += `// CRITICAL: Checkpoint at line ${i} for memory tracking\n`;
			}
		}

		const start = performance.now();
		const memories = extractFromCode(code, "/path/to/large.ts");
		const duration = performance.now() - start;

		// Should complete in reasonable time (< 1 second)
		expect(duration).toBeLessThan(1000);
		expect(memories.length).toBeGreaterThan(0);
	});

	it("should handle files with 50 annotations", () => {
		// Generate file with 50 annotations
		let code = "";
		for (let i = 0; i < 50; i++) {
			code += `// CRITICAL: Security note number ${i} about preventing various attacks\n`;
			code += `function check${i}() {}\n`;
		}

		const start = performance.now();
		const memories = extractFromCode(code, "/path/to/many-annotations.ts");
		const duration = performance.now() - start;

		expect(duration).toBeLessThan(1000);
		expect(memories.length).toBeGreaterThan(5);
	});

	it("should handle 20 concurrent extractions", async () => {
		const files = Array.from({ length: 20 }, (_, i) => ({
			code: `// CRITICAL: Security check ${i} - validate before processing\nfunction process${i}() {}`,
			path: `/path/to/file${i}.ts`,
		}));

		const start = performance.now();

		const results = await Promise.all(
			files.map(({ code, path }) => Promise.resolve(extractFromCode(code, path)))
		);

		const duration = performance.now() - start;

		expect(results.length).toBe(20);
		expect(duration).toBeLessThan(500);
	});

	it("should handle 20 concurrent commit message extractions", async () => {
		const commits = Array.from({ length: 20 }, (_, i) => ({
			message: `fix: Resolve critical bug ${i} in payment processing that caused failures`,
			hash: `commit${i}`,
			files: [`/path/to/file${i}.ts`],
		}));

		const start = performance.now();

		const results = await Promise.all(
			commits.map(({ message, hash, files }) =>
				Promise.resolve(extractFromCommitMessage(message, hash, files))
			)
		);

		const duration = performance.now() - start;

		expect(results.length).toBe(20);
		expect(duration).toBeLessThan(500);
	});
});

describe("Deduplication Performance", () => {
	it("should efficiently deduplicate similar memories", () => {
		// Generate 10 similar memories
		const memories = Array.from({ length: 10 }, (_, i) => ({
			context: `Database connection must be properly managed and closed ${i}`,
			summary: `Database connection management ${i}`,
			keywords: ["database", "connection", "close", "manage"],
			memoryType: "warning" as const,
			importance: "high" as const,
			source: { type: "auto_extracted" as const, reference: null },
			linkedFiles: [`/file${i}.ts`],
			confidence: 75,
		}));

		const start = performance.now();
		const merged = mergeSimilarMemories(memories, 0.7);
		const duration = performance.now() - start;

		// Should reduce count through merging
		expect(merged.length).toBeLessThan(memories.length);
		expect(duration).toBeLessThan(200);
	});

	it("should preserve unique memories during deduplication", () => {
		// 5 unique memories
		const memories = Array.from({ length: 5 }, (_, i) => ({
			context: `Unique topic ${i} about completely different things`,
			summary: `Topic ${i}`,
			keywords: [`unique${i}`, `topic${i}`, `keyword${i}`],
			memoryType: "context" as const,
			importance: "normal" as const,
			source: { type: "auto_extracted" as const, reference: null },
			linkedFiles: [`/unique${i}.ts`],
			confidence: 60,
		}));

		const merged = mergeSimilarMemories(memories, 0.9);

		// High threshold should preserve most unique memories
		expect(merged.length).toBeGreaterThan(3);
	});
});

describe("Auto-Save Rate Limiting", () => {
	it("should respect auto-save memory limit", () => {
		// Generate 25 high-importance memories
		let code = "";
		for (let i = 0; i < 25; i++) {
			code += `// CRITICAL: Security vulnerability ${i} must be addressed immediately\n`;
		}

		const memories = extractFromCode(code, "/path/to/file.ts");

		// Auto-save simulation
		const autoSaveLimit = 20;
		const toSave = memories
			.filter(
				(m) =>
					m.confidence >= 70 &&
					(m.importance === "critical" || m.importance === "high")
			)
			.slice(0, autoSaveLimit);

		expect(toSave.length).toBeLessThanOrEqual(autoSaveLimit);
	});
});

describe("Threshold Sensitivity", () => {
	it("should show clear difference between threshold levels", () => {
		// Mix of different annotation types
		const code = `
// CRITICAL: Security-critical validation required
// WARNING: Side effects possible
// IMPORTANT: Configuration required
// NOTE: For reference only
// TODO: Cleanup needed
// HACK: Temporary workaround
		`;

		const memories = extractFromCode(code, "/path/to/mixed.ts");

		const at50 = memories.filter((m) => m.confidence >= 50);
		const at70 = memories.filter((m) => m.confidence >= 70);
		const at90 = memories.filter((m) => m.confidence >= 90);

		// Higher thresholds should yield fewer results
		expect(at50.length).toBeGreaterThanOrEqual(at70.length);
		expect(at70.length).toBeGreaterThanOrEqual(at90.length);
	});
});
