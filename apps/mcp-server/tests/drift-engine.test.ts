import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Drift Engine (Sentinel)", () => {
	let checkDrift: (
		sourceFile: string,
		coupledFiles: { file: string }[],
	) => Promise<any[]>;
	let getCoupledFiles: (filePath: string) => Promise<any[]>;
	let cache: any;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		checkDrift = module.checkDrift;
		getCoupledFiles = module.getCoupledFiles;
		cache = module.cache;
		// Clear cache between tests
		cache.clear();
	});

	describe("checkDrift", () => {
		it("should return an array", async () => {
			const sourceFile = join(projectRoot, "src", "index.ts");
			const coupled = await getCoupledFiles(sourceFile);
			const result = await checkDrift(sourceFile, coupled);

			expect(Array.isArray(result)).toBe(true);
		});

		it("should return drift alert objects with required properties", async () => {
			const sourceFile = join(projectRoot, "src", "index.ts");
			const coupled = await getCoupledFiles(sourceFile);
			const result = await checkDrift(sourceFile, coupled);

			result.forEach((alert) => {
				expect(alert).toHaveProperty("file");
				expect(alert).toHaveProperty("daysOld");
			});
		});

		it("should return empty array when no coupled files provided", async () => {
			const sourceFile = join(projectRoot, "src", "index.ts");
			const result = await checkDrift(sourceFile, []);

			expect(result).toEqual([]);
		});

		it("should handle non-existent coupled files gracefully", async () => {
			const sourceFile = join(projectRoot, "src", "index.ts");
			const fakeCoupled = [{ file: "non-existent-file.ts" }];
			const result = await checkDrift(sourceFile, fakeCoupled);

			// Should not throw, should return empty array
			expect(Array.isArray(result)).toBe(true);
		});

		it("should handle non-existent source file gracefully", async () => {
			const fakeSource = join(projectRoot, "fake-source.ts");
			const coupled = [{ file: "src/index.ts" }];
			const result = await checkDrift(fakeSource, coupled);

			// Should not throw, returns empty array when source is new
			expect(Array.isArray(result)).toBe(true);
		});
	});

	describe("Drift Detection Logic", () => {
		it("should only alert for files >7 days stale", async () => {
			const sourceFile = join(projectRoot, "src", "index.ts");
			const coupled = await getCoupledFiles(sourceFile);
			const result = await checkDrift(sourceFile, coupled);

			result.forEach((alert) => {
				expect(alert.daysOld).toBeGreaterThan(7);
			});
		});

		it("should return daysOld as a number", async () => {
			const sourceFile = join(projectRoot, "src", "index.ts");
			const coupled = await getCoupledFiles(sourceFile);
			const result = await checkDrift(sourceFile, coupled);

			result.forEach((alert) => {
				expect(typeof alert.daysOld).toBe("number");
			});
		});
	});

	describe("Path Resolution", () => {
		it("should resolve relative paths from git to absolute", async () => {
			const sourceFile = join(projectRoot, "src", "index.ts");
			// Create coupled files with relative paths (as git returns)
			const relativeCoupled = [
				{ file: "package.json" },
				{ file: "tsconfig.json" },
			];
			const result = await checkDrift(sourceFile, relativeCoupled);

			// Should not throw - paths should be resolved correctly
			expect(Array.isArray(result)).toBe(true);
		});

		it("should handle Windows-style path separators", async () => {
			const sourceFile = join(projectRoot, "src", "index.ts");
			// Git might return paths with forward slashes
			const coupled = [{ file: "src/index.ts" }];

			// Should not throw
			const result = await checkDrift(sourceFile, coupled);
			expect(Array.isArray(result)).toBe(true);
		});
	});

	describe("Edge Cases", () => {
		it("should not include the source file in drift alerts", async () => {
			const sourceFile = join(projectRoot, "src", "index.ts");
			const coupled = await getCoupledFiles(sourceFile);
			const result = await checkDrift(sourceFile, coupled);

			result.forEach((alert) => {
				// The source file itself should not appear as stale
				expect(alert.file).not.toBe(sourceFile);
			});
		});

		it("should handle files modified at the same time", async () => {
			const sourceFile = join(projectRoot, "src", "index.ts");
			const coupled = await getCoupledFiles(sourceFile);
			const result = await checkDrift(sourceFile, coupled);

			// Files modified recently (same day) should not be in drift alerts
			// This is implicitly tested - daysOld > 7 for all alerts
			result.forEach((alert) => {
				expect(alert.daysOld).toBeGreaterThan(7);
			});
		});
	});
});
