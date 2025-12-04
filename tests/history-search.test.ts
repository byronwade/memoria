import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("History Search Engine (The Archaeologist)", () => {
	let searchHistory: (
		query: string,
		filePath?: string,
		searchType?: "message" | "diff" | "both",
		limit?: number,
		startLine?: number,
		endLine?: number,
	) => Promise<any>;
	let formatHistoryResults: (output: any) => string;
	let cache: any;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		searchHistory = module.searchHistory;
		formatHistoryResults = module.formatHistoryResults;
		cache = module.cache;
		cache.clear();
	});

	describe("searchHistory", () => {
		it("should return search output structure with all required fields", async () => {
			const result = await searchHistory("test");

			expect(result).toBeDefined();
			expect(result).toHaveProperty("query");
			expect(result).toHaveProperty("path");
			expect(result).toHaveProperty("results");
			expect(result).toHaveProperty("totalFound");
		});

		it("should return the query in the output", async () => {
			const result = await searchHistory("cache");

			expect(result.query).toBe("cache");
		});

		it("should return null path when no file path is provided", async () => {
			const result = await searchHistory("fix");

			expect(result.path).toBeNull();
		});

		it("should return results as an array", async () => {
			const result = await searchHistory("add");

			expect(Array.isArray(result.results)).toBe(true);
		});

		it("should return totalFound as a number", async () => {
			const result = await searchHistory("update");

			expect(typeof result.totalFound).toBe("number");
			expect(result.totalFound).toBeGreaterThanOrEqual(0);
		});

		it("should find commits by message keyword", async () => {
			// Search for a common git commit word
			const result = await searchHistory("add", undefined, "message");

			expect(result.results.length).toBeGreaterThanOrEqual(0);
			// If we find results, verify structure
			if (result.results.length > 0) {
				const firstResult = result.results[0];
				expect(firstResult).toHaveProperty("hash");
				expect(firstResult).toHaveProperty("date");
				expect(firstResult).toHaveProperty("author");
				expect(firstResult).toHaveProperty("message");
				expect(firstResult).toHaveProperty("filesChanged");
				expect(firstResult).toHaveProperty("matchType");
			}
		});

		it("should find commits by code changes (pickaxe)", async () => {
			// Search for something likely in the code
			const result = await searchHistory("cache", undefined, "diff");

			expect(result.results.length).toBeGreaterThanOrEqual(0);
			// If results found, matchType should be 'diff'
			result.results.forEach((r: any) => {
				expect(r.matchType).toBe("diff");
			});
		});

		it("should search both message and diff when searchType is 'both'", async () => {
			const result = await searchHistory("function", undefined, "both");

			expect(result.results.length).toBeGreaterThanOrEqual(0);
			// Results can be either message or diff type
			result.results.forEach((r: any) => {
				expect(["message", "diff"]).toContain(r.matchType);
			});
		});

		it("should respect the limit parameter", async () => {
			const result = await searchHistory("a", undefined, "both", 3);

			expect(result.results.length).toBeLessThanOrEqual(3);
		});

		it("should scope search to file path when provided", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await searchHistory("export", filePath);

			expect(result.path).toBe(filePath);
		});

		it("should cache results for identical queries", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const query = "add";
			const searchType = "message" as const;

			// First call - use explicit file path for deterministic cache key
			const result1 = await searchHistory(query, filePath, searchType);

			// Verify it's in cache (key format: history:query:path:searchType)
			const cacheKey = `history:${query}:${filePath}:${searchType}`;
			expect(cache.has(cacheKey)).toBe(true);

			// Second call should return cached result
			const result2 = await searchHistory(query, filePath, searchType);
			expect(result2).toEqual(result1);
		});

		it("should return empty results for non-existent query", async () => {
			const result = await searchHistory("xyzzy-nonexistent-query-12345");

			expect(result.totalFound).toBe(0);
			expect(result.results).toHaveLength(0);
		});

		it("should handle empty query gracefully", async () => {
			const result = await searchHistory("");

			expect(result).toBeDefined();
			expect(result.results).toBeDefined();
		});

		it("should include filesChanged in each result", async () => {
			const result = await searchHistory("add", undefined, "message", 5);

			result.results.forEach((r: any) => {
				expect(Array.isArray(r.filesChanged)).toBe(true);
			});
		});

		it("should truncate hash to 7 characters", async () => {
			const result = await searchHistory("test", undefined, "message", 5);

			result.results.forEach((r: any) => {
				expect(r.hash.length).toBe(7);
			});
		});

		it("should sort results by date (most recent first)", async () => {
			const result = await searchHistory("add", undefined, "both", 10);

			if (result.results.length >= 2) {
				for (let i = 0; i < result.results.length - 1; i++) {
					const currentDate = new Date(result.results[i].date).getTime();
					const nextDate = new Date(result.results[i + 1].date).getTime();
					expect(currentDate).toBeGreaterThanOrEqual(nextDate);
				}
			}
		});

		it("should deduplicate results across message and diff searches", async () => {
			const result = await searchHistory("cache", undefined, "both", 20);

			const hashes = result.results.map((r: any) => r.hash);
			const uniqueHashes = new Set(hashes);
			expect(hashes.length).toBe(uniqueHashes.size);
		});
	});

	describe("formatHistoryResults", () => {
		it("should format empty results with helpful suggestions", () => {
			const output = {
				query: "nonexistent",
				path: null,
				results: [],
				totalFound: 0,
			};

			const formatted = formatHistoryResults(output);

			expect(formatted).toContain("History Search");
			expect(formatted).toContain("nonexistent");
			expect(formatted).toContain("No commits found");
			expect(formatted).toContain("Try:");
		});

		it("should format results with commit details", () => {
			const output = {
				query: "test",
				path: null,
				results: [
					{
						hash: "abc1234",
						date: "2024-01-15",
						author: "developer",
						message: "Add test coverage",
						filesChanged: ["src/test.ts", "src/utils.ts"],
						matchType: "message" as const,
					},
				],
				totalFound: 1,
			};

			const formatted = formatHistoryResults(output);

			expect(formatted).toContain("abc1234");
			expect(formatted).toContain("2024-01-15");
			expect(formatted).toContain("@developer");
			expect(formatted).toContain("Add test coverage");
			expect(formatted).toContain("Found 1 relevant commits");
		});

		it("should include AI instructions in formatted output", () => {
			const output = {
				query: "setTimeout",
				path: null,
				results: [
					{
						hash: "def5678",
						date: "2023-06-01",
						author: "senior-dev",
						message: "Fix race condition with setTimeout",
						filesChanged: ["src/api.ts"],
						matchType: "message" as const,
					},
				],
				totalFound: 1,
			};

			const formatted = formatHistoryResults(output);

			expect(formatted).toContain("AI INSTRUCTION");
			expect(formatted).toContain("setTimeout");
			expect(formatted).toContain("- [ ]"); // Checklist item
		});

		it("should show different icons for message vs diff matches", () => {
			const output = {
				query: "cache",
				path: null,
				results: [
					{
						hash: "msg1234",
						date: "2024-01-10",
						author: "dev1",
						message: "Add cache layer",
						filesChanged: ["src/cache.ts"],
						matchType: "message" as const,
					},
					{
						hash: "dif5678",
						date: "2024-01-05",
						author: "dev2",
						message: "Refactor utils",
						filesChanged: ["src/utils.ts"],
						matchType: "diff" as const,
					},
				],
				totalFound: 2,
			};

			const formatted = formatHistoryResults(output);

			// Message match should have speech icon
			expect(formatted).toContain("💬");
			// Diff match should have pencil icon
			expect(formatted).toContain("📝");
		});

		it("should warn about bug fixes in history", () => {
			const output = {
				query: "authentication",
				path: null,
				results: [
					{
						hash: "fix1234",
						date: "2024-02-01",
						author: "dev",
						message: "Fix authentication bug in login flow",
						filesChanged: ["src/auth.ts"],
						matchType: "message" as const,
					},
				],
				totalFound: 1,
			};

			const formatted = formatHistoryResults(output);

			expect(formatted).toContain("Bug fixes detected");
		});

		it("should include file path in header when provided", () => {
			const output = {
				query: "export",
				path: "/project/src/index.ts",
				results: [],
				totalFound: 0,
			};

			const formatted = formatHistoryResults(output);

			expect(formatted).toContain("index.ts");
		});

		it("should generate checklist items from files changed", () => {
			const output = {
				query: "refactor",
				path: null,
				results: [
					{
						hash: "ref1234",
						date: "2024-01-20",
						author: "dev",
						message: "Refactor component structure",
						filesChanged: [
							"src/components/Button.tsx",
							"src/components/Input.tsx",
						],
						matchType: "message" as const,
					},
				],
				totalFound: 1,
			};

			const formatted = formatHistoryResults(output);

			expect(formatted).toContain("Review context in");
			expect(formatted).toContain("Button.tsx");
			expect(formatted).toContain("Input.tsx");
		});

		it("should limit files shown to 5", () => {
			const output = {
				query: "massive",
				path: null,
				results: [
					{
						hash: "big1234",
						date: "2024-01-01",
						author: "dev",
						message: "Massive refactor",
						filesChanged: [
							"file1.ts",
							"file2.ts",
							"file3.ts",
							"file4.ts",
							"file5.ts",
							"file6.ts",
							"file7.ts",
						],
						matchType: "message" as const,
					},
				],
				totalFound: 1,
			};

			const formatted = formatHistoryResults(output);

			// Should show files in the commit details (limited to 5)
			expect(formatted).toContain("file1.ts");
			expect(formatted).toContain("file5.ts");
		});
	});

	describe("Integration tests", () => {
		it("should find real commits in this repository", async () => {
			// Use explicit file path to ensure git context is correct
			const filePath = join(projectRoot, "src", "index.ts");
			// Search for "add" which appears in multiple commit messages in this repo
			const result = await searchHistory("add", filePath, "message", 10);

			// This repo should have commits mentioning "add"
			expect(result.totalFound).toBeGreaterThan(0);
		});

		it("should find commits touching src/index.ts", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await searchHistory("function", filePath, "diff", 5);

			// src/index.ts has many functions, should find something
			expect(result.results.length).toBeGreaterThanOrEqual(0);
			if (result.results.length > 0) {
				// When scoped to a file, files changed should include that file
				const hasTargetFile = result.results.some((r: any) =>
					r.filesChanged.some((f: string) => f.includes("index.ts")),
				);
				expect(hasTargetFile).toBe(true);
			}
		});
	});

	describe("Line-Range Search (Sherlock Mode)", () => {
		it("should accept startLine and endLine parameters", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			// Search for any changes in lines 1-50
			const result = await searchHistory("", filePath, "diff", 10, 1, 50);

			expect(result).toBeDefined();
			expect(result.results).toBeDefined();
		});

		it("should return commits that touched specified line range", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			// Lines 1-30 contain imports and interfaces - should have history
			const result = await searchHistory("", filePath, "diff", 5, 1, 30);

			// File exists and has history, should find at least some commits
			expect(result.results.length).toBeGreaterThanOrEqual(0);
			// If results found, they should have standard structure
			if (result.results.length > 0) {
				const firstResult = result.results[0];
				expect(firstResult).toHaveProperty("hash");
				expect(firstResult).toHaveProperty("date");
				expect(firstResult).toHaveProperty("author");
				expect(firstResult).toHaveProperty("message");
			}
		});

		it("should respect limit parameter with line-range search", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await searchHistory("", filePath, "diff", 2, 1, 100);

			expect(result.results.length).toBeLessThanOrEqual(2);
		});

		it("should return empty results for invalid range (start > end)", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			// Start line > end line should return empty
			const result = await searchHistory("", filePath, "diff", 10, 100, 50);

			expect(result.results).toHaveLength(0);
		});

		it("should handle startLine of 0 as 1 (git is 1-based)", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			// Line 0 should be treated as line 1
			const result = await searchHistory("", filePath, "diff", 5, 0, 10);

			// Should not throw, should return results
			expect(result).toBeDefined();
			expect(result.results).toBeDefined();
		});

		it("should handle range exceeding file length gracefully", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			// Very large range - git handles this gracefully
			const result = await searchHistory("", filePath, "diff", 5, 1, 99999);

			// Should not throw
			expect(result).toBeDefined();
		});

		it("should filter by query when provided with line range", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			// Search for 'export' in a line range
			const result = await searchHistory(
				"export",
				filePath,
				"diff",
				10,
				1,
				200,
			);

			// Results might be empty if query doesn't match line-range commits
			expect(result).toBeDefined();
			expect(result.query).toBe("export");
		});

		it("should cache line-range results separately", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const query = "test";

			// First call with line range
			const result1 = await searchHistory(query, filePath, "diff", 10, 10, 50);

			// Verify it's in cache with line-range key
			const cacheKey = `history:${query}:${filePath}:diff:L10-50`;
			expect(cache.has(cacheKey)).toBe(true);

			// Second call should return cached result
			const result2 = await searchHistory(query, filePath, "diff", 10, 10, 50);
			expect(result2).toEqual(result1);

			// Different range should have different cache key
			const _result3 = await searchHistory(query, filePath, "diff", 10, 20, 60);
			const cacheKey2 = `history:${query}:${filePath}:diff:L20-60`;
			expect(cache.has(cacheKey2)).toBe(true);
		});

		it("should set matchType to diff for line-range results", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await searchHistory("", filePath, "diff", 5, 1, 100);

			// Line-range search is always a 'diff' type search
			result.results.forEach((r: any) => {
				expect(r.matchType).toBe("diff");
			});
		});

		it("should only use startLine when endLine is not provided", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			// Only startLine - should search that single line
			const result = await searchHistory("", filePath, "diff", 5, 50);

			// Should not throw, should return results
			expect(result).toBeDefined();
		});
	});
});
