import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Test File Coupling Engine (getTestCoupling)", () => {
	let getTestCoupling: (filePath: string, ctx?: any) => Promise<any[]>;
	let cache: any;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		getTestCoupling = module.getTestCoupling;
		cache = module.cache;
		cache.clear();
	});

	describe("getTestCoupling", () => {
		it("should return an array", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTestCoupling(filePath);
			expect(Array.isArray(result)).toBe(true);
		});

		it("should cache results for subsequent calls", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result1 = await getTestCoupling(filePath);

			// Verify cache was set
			const cacheKey = `test-coupling:${filePath}`;
			expect(cache.has(cacheKey)).toBe(true);

			// Second call should return cached result
			const result2 = await getTestCoupling(filePath);
			expect(result2).toEqual(result1);
		});

		it("should return empty array for test files themselves", async () => {
			// Test files shouldn't report test coupling to themselves
			const testFilePath = join(projectRoot, "tests", "cache.test.ts");
			const result = await getTestCoupling(testFilePath);
			expect(result).toEqual([]);
		});

		it("should include source field set to 'test'", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTestCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.source).toBe("test");
			});
		});

		it("should include score, file, and reason fields", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTestCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(typeof coupling.file).toBe("string");
				expect(typeof coupling.score).toBe("number");
				expect(typeof coupling.reason).toBe("string");
			});
		});

		it("should limit results to 5 files", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTestCoupling(filePath);
			expect(result.length).toBeLessThanOrEqual(5);
		});

		it("should not include the source file itself", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTestCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.file).not.toBe("src/index.ts");
			});
		});

		it("should handle files with no matching tests gracefully", async () => {
			// package.json won't have associated test files
			const filePath = join(projectRoot, "package.json");
			const result = await getTestCoupling(filePath);
			expect(Array.isArray(result)).toBe(true);
		});

		it("should detect test file naming conventions", async () => {
			// The index.ts file should potentially match test files like:
			// index.test.ts, index.spec.ts, etc.
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTestCoupling(filePath);

			// Verify any found test files follow naming conventions
			result.forEach((coupling: any) => {
				if (coupling.file.includes("test") || coupling.file.includes("spec")) {
					expect(
						coupling.file.includes(".test.") ||
						coupling.file.includes(".spec.") ||
						coupling.file.includes("_test.") ||
						coupling.file.includes("test_")
					).toBe(true);
				}
			});
		});
	});
});
