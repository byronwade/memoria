import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Transitive/Re-Export Coupling Engine (getTransitiveCoupling)", () => {
	let getTransitiveCoupling: (filePath: string, ctx?: any) => Promise<any[]>;
	let cache: any;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		getTransitiveCoupling = module.getTransitiveCoupling;
		cache = module.cache;
		cache.clear();
	});

	describe("getTransitiveCoupling", () => {
		it("should return an array", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTransitiveCoupling(filePath);
			expect(Array.isArray(result)).toBe(true);
		});

		it("should cache results for subsequent calls", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result1 = await getTransitiveCoupling(filePath);

			// Verify cache was set
			const cacheKey = `transitive-coupling:${filePath}`;
			expect(cache.has(cacheKey)).toBe(true);

			// Second call should return cached result
			const result2 = await getTransitiveCoupling(filePath);
			expect(result2).toEqual(result1);
		});

		it("should return empty array for files not re-exported", async () => {
			// package.json won't be re-exported
			const filePath = join(projectRoot, "package.json");
			const result = await getTransitiveCoupling(filePath);
			expect(result).toEqual([]);
		});

		it("should include source field set to 'transitive'", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTransitiveCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.source).toBe("transitive");
			});
		});

		it("should include score, file, and reason fields", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTransitiveCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(typeof coupling.file).toBe("string");
				expect(typeof coupling.score).toBe("number");
				expect(typeof coupling.reason).toBe("string");
			});
		});

		it("should mention re-export or barrel in reason", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTransitiveCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.reason.toLowerCase()).toMatch(/re-?export|barrel|indirect|import|via/);
			});
		});

		it("should limit results to 5 files", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTransitiveCoupling(filePath);
			expect(result.length).toBeLessThanOrEqual(5);
		});

		it("should sort results by score descending", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTransitiveCoupling(filePath);

			if (result.length >= 2) {
				for (let i = 0; i < result.length - 1; i++) {
					expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
				}
			}
		});

		it("should not include the source file itself", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTransitiveCoupling(filePath);

			result.forEach((coupling: any) => {
				expect(coupling.file).not.toBe("src/index.ts");
			});
		});

		it("should handle files with no exports gracefully", async () => {
			const filePath = join(projectRoot, "tsconfig.json");
			const result = await getTransitiveCoupling(filePath);
			expect(Array.isArray(result)).toBe(true);
		});

		it("should detect barrel file re-exports", async () => {
			// The result should identify files that re-export through index.ts files
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getTransitiveCoupling(filePath);

			// If there are results, they should be barrels or transitive importers
			result.forEach((coupling: any) => {
				// Files should either be barrels (containing 'index') or transitive importers
				expect(
					coupling.reason.includes("Re-exports") ||
					coupling.reason.includes("Imports via") ||
					coupling.reason.includes("barrel") ||
					coupling.reason.includes("Indirect")
				).toBe(true);
			});
		});
	});
});
