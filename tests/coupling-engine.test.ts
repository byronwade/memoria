import { describe, it, expect, beforeEach } from "vitest";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Coupling Engine (Entanglement)", () => {
	let getCoupledFiles: (filePath: string) => Promise<any[]>;
	let cache: any;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		getCoupledFiles = module.getCoupledFiles;
		cache = module.cache;
		// Clear cache between tests
		cache.clear();
	});

	describe("getCoupledFiles", () => {
		it("should return an array", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getCoupledFiles(filePath);

			expect(Array.isArray(result)).toBe(true);
		});

		it("should return coupled file objects with required properties", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getCoupledFiles(filePath);

			if (result.length > 0) {
				const first = result[0];
				expect(first).toHaveProperty("file");
				expect(first).toHaveProperty("score");
				expect(first).toHaveProperty("reason");
				expect(first).toHaveProperty("lastHash");
				expect(first).toHaveProperty("evidence");
			}
		});

		it("should return max 5 coupled files", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getCoupledFiles(filePath);

			expect(result.length).toBeLessThanOrEqual(5);
		});

		it("should only return files with >15% coupling score", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getCoupledFiles(filePath);

			result.forEach((item) => {
				expect(item.score).toBeGreaterThan(15);
			});
		});

		it("should sort results by score descending", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getCoupledFiles(filePath);

			for (let i = 1; i < result.length; i++) {
				expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
			}
		});

		it("should cache results for subsequent calls", async () => {
			const filePath = join(projectRoot, "src", "index.ts");

			// First call
			const result1 = await getCoupledFiles(filePath);

			// Verify it's in cache
			const cacheKey = `coupling:${filePath}`;
			expect(cache.has(cacheKey)).toBe(true);

			// Second call should return cached result
			const result2 = await getCoupledFiles(filePath);
			expect(result2).toEqual(result1);
		});

		it("should return empty array for file with no git history", async () => {
			// A path that doesn't exist
			const fakePath = join(projectRoot, "non-existent-file.ts");
			const result = await getCoupledFiles(fakePath);

			expect(result).toEqual([]);
		});
	});

	describe("Evidence Fetching", () => {
		it("should include evidence (diff snippet) for coupled files", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getCoupledFiles(filePath);

			result.forEach((item) => {
				expect(typeof item.evidence).toBe("string");
			});
		});

		it("should include commit hash for each coupled file", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getCoupledFiles(filePath);

			result.forEach((item) => {
				expect(typeof item.lastHash).toBe("string");
				expect(item.lastHash.length).toBeGreaterThan(0);
			});
		});

		it("should include commit message (reason) for each coupled file", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getCoupledFiles(filePath);

			result.forEach((item) => {
				expect(typeof item.reason).toBe("string");
			});
		});
	});

	describe("Ignore Patterns", () => {
		it("should not include node_modules files", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getCoupledFiles(filePath);

			result.forEach((item) => {
				expect(item.file).not.toContain("node_modules");
			});
		});

		it("should not include package-lock.json", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getCoupledFiles(filePath);

			result.forEach((item) => {
				expect(item.file).not.toBe("package-lock.json");
			});
		});

		it("should not include dist folder files", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getCoupledFiles(filePath);

			result.forEach((item) => {
				expect(item.file).not.toMatch(/^dist\//);
			});
		});

		it("should not include build folder files", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getCoupledFiles(filePath);

			result.forEach((item) => {
				expect(item.file).not.toMatch(/^build\//);
			});
		});
	});

	describe("Coupling Score Calculation", () => {
		it("should calculate score as percentage of total commits", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getCoupledFiles(filePath);

			// Scores should be valid percentages
			result.forEach((item) => {
				expect(item.score).toBeGreaterThan(0);
				expect(item.score).toBeLessThanOrEqual(100);
			});
		});

		it("should return scores as integers", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getCoupledFiles(filePath);

			result.forEach((item) => {
				expect(Number.isInteger(item.score)).toBe(true);
			});
		});
	});
});
