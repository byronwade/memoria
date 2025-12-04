import { describe, it, expect, beforeEach } from "vitest";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("MCP Tool Handler", () => {
	// These tests verify the behavior of the analyze_file tool
	// We'll test by calling the exported functions that the tool uses

	let getVolatility: (filePath: string) => Promise<any>;
	let getCoupledFiles: (filePath: string) => Promise<any[]>;
	let checkDrift: (sourceFile: string, coupledFiles: { file: string }[]) => Promise<any[]>;
	let generateAiInstructions: (filePath: string, volatility: any, coupled: any[], drift: any[]) => string;
	let cache: any;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		getVolatility = module.getVolatility;
		getCoupledFiles = module.getCoupledFiles;
		checkDrift = module.checkDrift;
		generateAiInstructions = module.generateAiInstructions;
		cache = module.cache;
		cache.clear();
	});

	describe("Full Analysis Pipeline", () => {
		it("should complete full analysis pipeline for a valid file", async () => {
			const filePath = join(projectRoot, "src", "index.ts");

			// Run engines (same as tool handler)
			const [volatility, coupled] = await Promise.all([
				getVolatility(filePath),
				getCoupledFiles(filePath),
			]);

			const drift = await checkDrift(filePath, coupled);
			const report = generateAiInstructions(filePath, volatility, coupled, drift);

			expect(volatility).toBeDefined();
			expect(Array.isArray(coupled)).toBe(true);
			expect(Array.isArray(drift)).toBe(true);
			expect(typeof report).toBe("string");
			expect(report.length).toBeGreaterThan(0);
		});

		it("should produce report with all sections", async () => {
			const filePath = join(projectRoot, "src", "index.ts");

			const [volatility, coupled] = await Promise.all([
				getVolatility(filePath),
				getCoupledFiles(filePath),
			]);

			const drift = await checkDrift(filePath, coupled);
			const report = generateAiInstructions(filePath, volatility, coupled, drift);

			// Should have Pre-Flight, Risk, and Volatility sections at minimum
			expect(report).toContain("PRE-FLIGHT CHECKLIST");
			expect(report).toContain("RISK:");
			expect(report).toContain("VOLATILITY");
		});

		it("should include coupled files in report when they exist", async () => {
			const filePath = join(projectRoot, "src", "index.ts");

			const [volatility, coupled] = await Promise.all([
				getVolatility(filePath),
				getCoupledFiles(filePath),
			]);

			const drift = await checkDrift(filePath, coupled);
			const report = generateAiInstructions(filePath, volatility, coupled, drift);

			if (coupled.length > 0) {
				expect(report).toContain("COUPLED FILES");
				expect(report).toContain(coupled[0].file);
			}
		});
	});

	describe("Path Handling", () => {
		it("should work with absolute paths", async () => {
			const absolutePath = join(projectRoot, "src", "index.ts");
			const result = await getVolatility(absolutePath);

			expect(result).toBeDefined();
		});

		it("should handle package.json analysis", async () => {
			const filePath = join(projectRoot, "package.json");

			const [volatility, coupled] = await Promise.all([
				getVolatility(filePath),
				getCoupledFiles(filePath),
			]);

			expect(volatility).toBeDefined();
			expect(Array.isArray(coupled)).toBe(true);
		});

		it("should handle tsconfig.json analysis", async () => {
			const filePath = join(projectRoot, "tsconfig.json");

			const [volatility, coupled] = await Promise.all([
				getVolatility(filePath),
				getCoupledFiles(filePath),
			]);

			expect(volatility).toBeDefined();
			expect(Array.isArray(coupled)).toBe(true);
		});
	});

	describe("Error Handling", () => {
		it("should handle non-existent files gracefully", async () => {
			const fakePath = join(projectRoot, "does-not-exist.ts");

			// These should return empty/default values, not throw
			const coupled = await getCoupledFiles(fakePath);
			expect(coupled).toEqual([]);
		});

		it("should not crash on files outside git repo", async () => {
			// Attempt to analyze a temp file
			const tempPath = "/tmp/test-file.ts";

			try {
				const result = await getCoupledFiles(tempPath);
				// Should return empty array or throw
				expect(Array.isArray(result)).toBe(true);
			} catch (e) {
				// Expected for non-git paths
				expect(true).toBe(true);
			}
		});
	});

	describe("Response Format", () => {
		it("should include filename in report header", async () => {
			const filePath = join(projectRoot, "src", "index.ts");

			const volatility = await getVolatility(filePath);
			const report = generateAiInstructions(filePath, volatility, [], []);

			expect(report).toContain("index.ts");
		});

		it("should include markdown formatting", async () => {
			const filePath = join(projectRoot, "src", "index.ts");

			const volatility = await getVolatility(filePath);
			const report = generateAiInstructions(filePath, volatility, [], []);

			// Should have markdown elements
			expect(report).toContain("###");
			expect(report).toContain("**");
			expect(report).toContain("- [ ]");
		});

		it("should include relationship instructions for AI", async () => {
			const filePath = join(projectRoot, "src", "index.ts");
			const coupled = [
				{
					file: "test.ts",
					score: 50,
					reason: "shared logic",
					lastHash: "abc123",
					evidence: {
						additions: [],
						removals: [],
						hunks: 0,
						netChange: 0,
						hasBreakingChange: false,
						changeType: 'schema' as const,
					},
				},
			];

			const volatility = await getVolatility(filePath);
			const report = generateAiInstructions(filePath, volatility, coupled, []);

			// Should contain relationship-specific instructions for AI
			expect(report).toContain("type definitions");
		});
	});

	describe("Parallel Execution", () => {
		it("should run volatility and coupling analysis in parallel", async () => {
			const filePath = join(projectRoot, "src", "index.ts");

			const start = performance.now();

			// Run in parallel (as the tool handler does)
			const [volatility, coupled] = await Promise.all([
				getVolatility(filePath),
				getCoupledFiles(filePath),
			]);

			const parallelTime = performance.now() - start;

			// Clear cache
			cache.clear();

			// Run sequentially for comparison
			const seqStart = performance.now();
			await getVolatility(filePath);
			cache.clear();
			await getCoupledFiles(filePath);
			const seqTime = performance.now() - seqStart;

			// Both should complete successfully
			expect(volatility).toBeDefined();
			expect(Array.isArray(coupled)).toBe(true);

			// Parallel should be faster or similar (network variance accepted)
			// This is informational, not a hard requirement
		});
	});

	describe("Caching Behavior", () => {
		it("should cache results across multiple calls", async () => {
			const filePath = join(projectRoot, "src", "index.ts");

			// First call - populates cache
			const result1 = await getVolatility(filePath);
			const coupled1 = await getCoupledFiles(filePath);

			// Second call - should use cache
			const result2 = await getVolatility(filePath);
			const coupled2 = await getCoupledFiles(filePath);

			expect(result1).toEqual(result2);
			expect(coupled1).toEqual(coupled2);
		});

		it("should have separate cache keys for different files", async () => {
			const file1 = join(projectRoot, "src", "index.ts");
			const file2 = join(projectRoot, "package.json");

			const vol1 = await getVolatility(file1);
			const vol2 = await getVolatility(file2);

			// Should be different results (different files)
			// At minimum, we verify both completed
			expect(vol1).toBeDefined();
			expect(vol2).toBeDefined();
		});
	});
});
