import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Import Detection Engine (getImporters)", () => {
	let getImporters: (filePath: string) => Promise<string[]>;
	let cache: any;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		getImporters = module.getImporters;
		cache = module.cache;
		// Clear cache between tests
		cache.clear();
	});

	describe("Basic Functionality", () => {
		it("should return an array", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getImporters(filePath);

			expect(Array.isArray(result)).toBe(true);
		});

		it("should return strings (file paths) in the array", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getImporters(filePath);

			result.forEach((item) => {
				expect(typeof item).toBe("string");
			});
		});

		it("should cache results for subsequent calls", async () => {
			const filePath = join(projectRoot, "src", "index.ts");

			// First call
			const result1 = await getImporters(filePath);

			// Verify it's in cache
			const cacheKey = `importers:${filePath}`;
			expect(cache.has(cacheKey)).toBe(true);

			// Second call should return cached result
			const result2 = await getImporters(filePath);
			expect(result2).toEqual(result1);
		});

		it("should handle paths outside git repo gracefully", async () => {
			const fakePath = "/tmp/totally-fake-unique-name-xyz123.ts";
			const result = await getImporters(fakePath);

			// Should return empty array for files outside git repo
			expect(Array.isArray(result)).toBe(true);
		});

		it("should not include the exact source file path in importers", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getImporters(filePath);

			// Should not contain the source file's relative path
			result.forEach((file) => {
				expect(file).not.toBe("src/index.ts");
			});
		});
	});

	describe("Ignore Patterns", () => {
		it("should not include node_modules in importers", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getImporters(filePath);

			result.forEach((file) => {
				expect(file).not.toContain("node_modules");
			});
		});

		it("should not include dist folder in importers", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getImporters(filePath);

			result.forEach((file) => {
				expect(file).not.toMatch(/^dist\//);
			});
		});

		it("should not include build folder in importers", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getImporters(filePath);

			result.forEach((file) => {
				expect(file).not.toMatch(/^build\//);
			});
		});
	});

	describe("Deduplication", () => {
		it("should return unique file paths only", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const result = await getImporters(filePath);

			const uniqueSet = new Set(result);
			expect(result.length).toBe(uniqueSet.size);
		});
	});

	describe("Integration with Compound Risk", () => {
		let calculateCompoundRisk: any;

		beforeEach(async () => {
			const module = await import("../src/index.js");
			calculateCompoundRisk = module.calculateCompoundRisk;
		});

		it("should increase risk score when file has many importers", () => {
			const volatility = { panicScore: 0, commitCount: 10 };
			const coupled: any[] = [];
			const drift: any[] = [];
			const noImporters: string[] = [];
			const manyImporters = Array(10).fill("file.ts");

			const riskWithNoImporters = calculateCompoundRisk(
				volatility,
				coupled,
				drift,
				noImporters,
			);
			const riskWithManyImporters = calculateCompoundRisk(
				volatility,
				coupled,
				drift,
				manyImporters,
			);

			expect(riskWithManyImporters.score).toBeGreaterThan(
				riskWithNoImporters.score,
			);
		});

		it("should include importer count in risk factors when >= 5", () => {
			const volatility = { panicScore: 0, commitCount: 10 };
			const coupled: any[] = [];
			const drift: any[] = [];
			const importers = Array(5).fill("file.ts");

			const risk = calculateCompoundRisk(volatility, coupled, drift, importers);

			expect(risk.factors.some((f: string) => f.includes("imported"))).toBe(
				true,
			);
		});

		it("should not include importer factor when < 5 importers", () => {
			const volatility = { panicScore: 0, commitCount: 10 };
			const coupled: any[] = [];
			const drift: any[] = [];
			const importers = ["file1.ts", "file2.ts"];

			const risk = calculateCompoundRisk(volatility, coupled, drift, importers);

			expect(risk.factors.some((f: string) => f.includes("imported"))).toBe(
				false,
			);
		});
	});

	describe("Integration with Output Formatter", () => {
		let generateAiInstructions: any;

		beforeEach(async () => {
			const module = await import("../src/index.js");
			generateAiInstructions = module.generateAiInstructions;
		});

		it("should include Static Dependents section when importers exist", () => {
			const volatility = {
				panicScore: 0,
				commitCount: 10,
				authors: 1,
				lastCommitDate: "2024-01-01",
			};
			const coupled: any[] = [];
			const drift: any[] = [];
			const importers = ["src/component.tsx", "src/service.ts"];

			const result = generateAiInstructions(
				"/path/to/file.ts",
				volatility,
				coupled,
				drift,
				importers,
			);

			expect(result).toContain("Static Dependents");
			expect(result).toContain("component.tsx");
			expect(result).toContain("service.ts");
		});

		it("should not include Static Dependents section when no importers", () => {
			const volatility = {
				panicScore: 0,
				commitCount: 10,
				authors: 1,
				lastCommitDate: "2024-01-01",
			};
			const coupled: any[] = [];
			const drift: any[] = [];
			const importers: string[] = [];

			const result = generateAiInstructions(
				"/path/to/file.ts",
				volatility,
				coupled,
				drift,
				importers,
			);

			expect(result).not.toContain("Static Dependents");
		});

		it("should show truncation message when more than 8 importers", () => {
			const volatility = {
				panicScore: 0,
				commitCount: 10,
				authors: 1,
				lastCommitDate: "2024-01-01",
			};
			const coupled: any[] = [];
			const drift: any[] = [];
			const importers = Array(12)
				.fill(0)
				.map((_, i) => `file${i}.ts`);

			const result = generateAiInstructions(
				"/path/to/file.ts",
				volatility,
				coupled,
				drift,
				importers,
			);

			expect(result).toContain("and 4 more");
		});

		it("should add importers to pre-flight checklist", () => {
			const volatility = {
				panicScore: 0,
				commitCount: 10,
				authors: 1,
				lastCommitDate: "2024-01-01",
			};
			const coupled: any[] = [];
			const drift: any[] = [];
			const importers = ["src/component.tsx"];

			const result = generateAiInstructions(
				"/path/to/file.ts",
				volatility,
				coupled,
				drift,
				importers,
			);

			expect(result).toContain("(importer)");
		});
	});
});
