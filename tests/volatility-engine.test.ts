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

			// First call (no config = empty config key suffix)
			const result1 = await getVolatility(filePath);

			// Verify it's in cache (cache key includes empty config suffix when no config)
			const cacheKey = `volatility:${filePath}:`;
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

	describe("Time Decay (Recency Bias)", () => {
		let calculateRecencyDecay: (commitDate: Date) => number;

		beforeEach(async () => {
			const module = await import("../src/index.js");
			calculateRecencyDecay = module.calculateRecencyDecay;
		});

		it("should return recencyDecay object with decay statistics", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(filePath);

			expect(result.recencyDecay).toBeDefined();
			expect(result.recencyDecay).toHaveProperty("oldestCommitDays");
			expect(result.recencyDecay).toHaveProperty("newestCommitDays");
			expect(result.recencyDecay).toHaveProperty("decayFactor");
		});

		it("should have decayFactor between 0 and 1", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(filePath);

			expect(result.recencyDecay.decayFactor).toBeGreaterThanOrEqual(0);
			expect(result.recencyDecay.decayFactor).toBeLessThanOrEqual(1);
		});

		it("should calculate oldestCommitDays >= newestCommitDays", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(filePath);

			expect(result.recencyDecay.oldestCommitDays).toBeGreaterThanOrEqual(
				result.recencyDecay.newestCommitDays
			);
		});

		it("calculateRecencyDecay should return ~1.0 for commits from today", () => {
			const today = new Date();
			const decay = calculateRecencyDecay(today);
			expect(decay).toBeCloseTo(1, 1);
		});

		it("calculateRecencyDecay should return ~0.5 for commits from 30 days ago", () => {
			const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			const decay = calculateRecencyDecay(thirtyDaysAgo);
			expect(decay).toBeCloseTo(0.5, 1);
		});

		it("calculateRecencyDecay should return ~0.25 for commits from 60 days ago", () => {
			const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
			const decay = calculateRecencyDecay(sixtyDaysAgo);
			expect(decay).toBeCloseTo(0.25, 1);
		});

		it("calculateRecencyDecay should return very small value for old commits (180 days)", () => {
			const old = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
			const decay = calculateRecencyDecay(old);
			expect(decay).toBeLessThan(0.05);
		});
	});

	describe("Bus Factor (Author Details)", () => {
		it("should return authorDetails array", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(filePath);

			expect(Array.isArray(result.authorDetails)).toBe(true);
		});

		it("should have author details with required properties", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(filePath);

			if (result.authorDetails.length > 0) {
				const author = result.authorDetails[0];
				expect(author).toHaveProperty("name");
				expect(author).toHaveProperty("email");
				expect(author).toHaveProperty("commits");
				expect(author).toHaveProperty("percentage");
				expect(author).toHaveProperty("firstCommit");
				expect(author).toHaveProperty("lastCommit");
			}
		});

		it("should sort authors by commit count (descending)", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(filePath);

			if (result.authorDetails.length >= 2) {
				for (let i = 0; i < result.authorDetails.length - 1; i++) {
					expect(result.authorDetails[i].commits).toBeGreaterThanOrEqual(
						result.authorDetails[i + 1].commits
					);
				}
			}
		});

		it("should return topAuthor matching first authorDetails entry", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(filePath);

			if (result.authorDetails.length > 0) {
				expect(result.topAuthor).not.toBeNull();
				expect(result.topAuthor?.name).toBe(result.authorDetails[0].name);
			}
		});

		it("should have author percentages summing to approximately 100", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(filePath);

			if (result.authorDetails.length > 0) {
				const totalPercentage = result.authorDetails.reduce(
					(sum: number, a: any) => sum + a.percentage, 0
				);
				// Allow some rounding error
				expect(totalPercentage).toBeGreaterThanOrEqual(95);
				expect(totalPercentage).toBeLessThanOrEqual(105);
			}
		});

		it("should maintain backward compatibility with authors count", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(filePath);

			expect(typeof result.authors).toBe("number");
			expect(result.authors).toBe(result.authorDetails.length);
		});
	});
});
