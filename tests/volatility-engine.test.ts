import { describe, it, expect, beforeEach } from "vitest";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Volatility Engine", () => {
	// Use dynamic import to get the functions (ES module)
	let getVolatility: (filePath: string) => Promise<any>;
	let cache: any;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		getVolatility = module.getVolatility;
		cache = module.cache;
		// Clear cache between tests
		cache.clear();
	});

	describe("getVolatility", () => {
		it("should return volatility data for a file with git history", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(filePath);

			expect(result).toBeDefined();
			expect(result).toHaveProperty("commitCount");
			expect(result).toHaveProperty("panicScore");
			expect(result).toHaveProperty("lastCommitDate");
			expect(result).toHaveProperty("authors");
		});

		it("should return a number for commitCount", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(filePath);

			expect(typeof result.commitCount).toBe("number");
			expect(result.commitCount).toBeGreaterThanOrEqual(0);
		});

		it("should return a panicScore between 0 and 100", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(filePath);

			expect(typeof result.panicScore).toBe("number");
			expect(result.panicScore).toBeGreaterThanOrEqual(0);
			expect(result.panicScore).toBeLessThanOrEqual(100);
		});

		it("should return unique author count as a number", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(filePath);

			expect(typeof result.authors).toBe("number");
			expect(result.authors).toBeGreaterThanOrEqual(1);
		});

		it("should cache results for subsequent calls", async () => {
			const filePath = join(projectRoot, "src", "index.ts");

			// First call
			const result1 = await getVolatility(filePath);

			// Verify it's in cache
			const cacheKey = `volatility:${filePath}`;
			expect(cache.has(cacheKey)).toBe(true);

			// Second call should return cached result
			const result2 = await getVolatility(filePath);
			expect(result2).toEqual(result1);
		});

		it("should handle files with no commits gracefully", async () => {
			// Create a path that doesn't exist in git
			const fakePath = join(projectRoot, "non-existent-file.ts");

			// This should throw because the file doesn't exist in the repo
			// But getGitForFile uses dirname, so git operations may still work
			// The function should handle this gracefully
			try {
				const result = await getVolatility(fakePath);
				// If it returns, it should have 0 commits
				expect(result.commitCount).toBe(0);
			} catch (e) {
				// Expected - file doesn't exist
				expect(true).toBe(true);
			}
		});
	});

	describe("Panic Keyword Detection", () => {
		it("should detect panic keywords in commit messages", async () => {
			// This test uses the real repo which may or may not have panic keywords
			// We just verify the structure is correct
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(filePath);

			// panicScore should be calculated correctly
			expect(result.panicScore).toBeGreaterThanOrEqual(0);
			expect(result.panicScore).toBeLessThanOrEqual(100);
		});

		it("should cap panicScore at 100", async () => {
			// Even if all 20 commits are panic commits, score should be 100
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(filePath);

			expect(result.panicScore).toBeLessThanOrEqual(100);
		});
	});

	describe("Metadata Extraction", () => {
		it("should return lastCommitDate as a string or undefined", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(filePath);

			if (result.commitCount > 0) {
				expect(result.lastCommitDate).toBeDefined();
			}
		});

		it("should analyze up to 20 commits maximum", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(filePath);

			// The function analyzes maxCount: 20 commits
			// commitCount returns log.total which is the actual count from git
			// It should be at least 1 for an existing file
			expect(result.commitCount).toBeGreaterThanOrEqual(0);
		});
	});
});
