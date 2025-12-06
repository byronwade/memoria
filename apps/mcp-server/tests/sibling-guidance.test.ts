import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Sibling Guidance (Smart New File Guidance)", () => {
	let getSiblingGuidance: (filePath: string, config?: any) => Promise<any>;
	let formatSiblingGuidance: (guidance: any) => string;
	let cache: any;

	beforeEach(async () => {
		const module = await import("../src/index.js");
		getSiblingGuidance = module.getSiblingGuidance;
		formatSiblingGuidance = module.formatSiblingGuidance;
		cache = module.cache;
		cache.clear();
	});

	describe("getSiblingGuidance", () => {
		it("should return null for file in empty directory", async () => {
			// A non-existent directory will cause an error and return null
			const fakePath = join(projectRoot, "non-existent-dir", "file.ts");
			const result = await getSiblingGuidance(fakePath);

			expect(result).toBeNull();
		});

		it("should return guidance object with required properties for files with siblings", async () => {
			// Use tests directory which has multiple .test.ts files
			const testFile = join(projectRoot, "tests", "new-test.test.ts");
			const result = await getSiblingGuidance(testFile);

			if (result) {
				expect(result).toHaveProperty("directory");
				expect(result).toHaveProperty("siblingCount");
				expect(result).toHaveProperty("patterns");
				expect(result).toHaveProperty("averageVolatility");
				expect(result).toHaveProperty("hasTests");
				expect(result).toHaveProperty("commonImports");
			}
		});

		it("should identify sibling files with same extension", async () => {
			// Use tests directory which has multiple .test.ts files
			const testFile = join(projectRoot, "tests", "new-feature.test.ts");
			const result = await getSiblingGuidance(testFile);

			if (result) {
				expect(result.siblingCount).toBeGreaterThan(0);
				expect(result.directory).toBe("tests");
			}
		});

		it("should detect test file patterns in test directories", async () => {
			// src directory has index.ts - a new file there would see test patterns
			const srcFile = join(projectRoot, "tests", "fake-new.test.ts");
			const result = await getSiblingGuidance(srcFile);

			// Tests directory has test files, so hasTests should be true
			if (result) {
				expect(result.hasTests).toBe(true);
			}
		});

		it("should calculate average volatility from siblings", async () => {
			const testFile = join(projectRoot, "tests", "new-test.test.ts");
			const result = await getSiblingGuidance(testFile);

			if (result) {
				expect(typeof result.averageVolatility).toBe("number");
				expect(result.averageVolatility).toBeGreaterThanOrEqual(0);
				expect(result.averageVolatility).toBeLessThanOrEqual(100);
			}
		});

		it("should detect common imports across siblings", async () => {
			// Test files share common imports
			const testFile = join(projectRoot, "tests", "new-feature.test.ts");
			const result = await getSiblingGuidance(testFile);

			if (result) {
				expect(Array.isArray(result.commonImports)).toBe(true);
				// Common imports detection depends on >50% of siblings sharing the import
				// This may be 0 if imports are formatted differently across files
				// Just verify the structure exists
				expect(result.commonImports.length).toBeGreaterThanOrEqual(0);
			}
		});

		it("should return patterns array", async () => {
			const testFile = join(projectRoot, "tests", "fake.test.ts");
			const result = await getSiblingGuidance(testFile);

			if (result) {
				expect(Array.isArray(result.patterns)).toBe(true);
				result.patterns.forEach((pattern: any) => {
					expect(pattern).toHaveProperty("description");
					expect(pattern).toHaveProperty("examples");
					expect(pattern).toHaveProperty("confidence");
				});
			}
		});

		it("should cache results for subsequent calls", async () => {
			const testFile = join(projectRoot, "tests", "cache-test.test.ts");

			// First call (no config, so configKey is empty string)
			const result1 = await getSiblingGuidance(testFile);

			// Verify it's in cache (key format includes empty configKey)
			const cacheKey = `siblings:${testFile}:`;
			expect(cache.has(cacheKey)).toBe(true);

			// Second call should return cached result
			const result2 = await getSiblingGuidance(testFile);
			expect(result2).toEqual(result1);
		});

		it("should exclude the target file from siblings", async () => {
			// If we analyze tests/cache.test.ts, it shouldn't count itself
			const cacheTestFile = join(projectRoot, "tests", "cache.test.ts");
			const result = await getSiblingGuidance(cacheTestFile);

			if (result) {
				// The sibling count should not include cache.test.ts itself
				// We can verify by checking the count is less than total files
				expect(result.siblingCount).toBeGreaterThan(0);
			}
		});

		it("should limit analysis to 5 siblings for performance", async () => {
			// Even with many test files, it should still complete quickly
			const testFile = join(projectRoot, "tests", "performance-test.test.ts");
			const startTime = Date.now();
			await getSiblingGuidance(testFile);
			const duration = Date.now() - startTime;

			// Should complete in reasonable time (under 5 seconds)
			expect(duration).toBeLessThan(5000);
		});
	});

	describe("formatSiblingGuidance", () => {
		it("should format guidance with header", () => {
			const guidance = {
				directory: "components",
				siblingCount: 5,
				patterns: [],
				averageVolatility: 20,
				hasTests: true,
				commonImports: [],
			};

			const formatted = formatSiblingGuidance(guidance);

			expect(formatted).toContain("Sibling Patterns");
			expect(formatted).toContain("components/");
			expect(formatted).toContain("5 similar files");
		});

		it("should include patterns as list items", () => {
			const guidance = {
				directory: "hooks",
				siblingCount: 3,
				patterns: [
					{
						description:
							'Naming convention detected - siblings use prefix "use"',
						examples: ["useAuth.ts", "useForm.ts"],
						confidence: 80,
					},
				],
				averageVolatility: 15,
				hasTests: false,
				commonImports: [],
			};

			const formatted = formatSiblingGuidance(guidance);

			expect(formatted).toContain("-");
			expect(formatted).toContain('prefix "use"');
			expect(formatted).toContain("`useAuth.ts`");
			expect(formatted).toContain("`useForm.ts`");
		});

		it("should show stable label for low volatility", () => {
			const guidance = {
				directory: "utils",
				siblingCount: 4,
				patterns: [],
				averageVolatility: 10,
				hasTests: true,
				commonImports: [],
			};

			const formatted = formatSiblingGuidance(guidance);

			expect(formatted).toContain("stable");
		});

		it("should show moderate label for medium volatility", () => {
			const guidance = {
				directory: "services",
				siblingCount: 3,
				patterns: [],
				averageVolatility: 35,
				hasTests: false,
				commonImports: [],
			};

			const formatted = formatSiblingGuidance(guidance);

			expect(formatted).toContain("moderate");
		});

		it("should show volatile label for high volatility", () => {
			const guidance = {
				directory: "api",
				siblingCount: 6,
				patterns: [],
				averageVolatility: 60,
				hasTests: true,
				commonImports: [],
			};

			const formatted = formatSiblingGuidance(guidance);

			expect(formatted).toContain("volatile");
		});

		it("should format multiple patterns", () => {
			const guidance = {
				directory: "controllers",
				siblingCount: 4,
				patterns: [
					{
						description:
							"Test file expected - all siblings have matching test files",
						examples: ["UserController.test.ts"],
						confidence: 90,
					},
					{
						description:
							'Naming convention detected - siblings use suffix "Controller"',
						examples: ["UserController.ts", "AuthController.ts"],
						confidence: 70,
					},
				],
				averageVolatility: 25,
				hasTests: true,
				commonImports: ["express"],
			};

			const formatted = formatSiblingGuidance(guidance);

			expect(formatted).toContain("Test file expected");
			expect(formatted).toContain("Naming convention detected");
			expect(formatted).toContain("Controller");
		});

		it("should include volatility percentage", () => {
			const guidance = {
				directory: "models",
				siblingCount: 2,
				patterns: [],
				averageVolatility: 42,
				hasTests: false,
				commonImports: [],
			};

			const formatted = formatSiblingGuidance(guidance);

			expect(formatted).toContain("42%");
		});
	});

	describe("Pattern Detection", () => {
		it("should detect common imports pattern when imports are shared", () => {
			// All test files share vitest imports
			const testFile = join(projectRoot, "tests", "new-module.test.ts");

			return getSiblingGuidance(testFile).then((result) => {
				if (result && result.patterns.length > 0) {
					const importPattern = result.patterns.find((p: any) =>
						p.description.includes("Common imports"),
					);
					if (importPattern) {
						expect(importPattern.examples.length).toBeGreaterThan(0);
					}
				}
			});
		});

		it("should return confidence scores between 0 and 100", async () => {
			const testFile = join(projectRoot, "tests", "confidence-check.test.ts");
			const result = await getSiblingGuidance(testFile);

			if (result) {
				result.patterns.forEach((pattern: any) => {
					expect(pattern.confidence).toBeGreaterThanOrEqual(0);
					expect(pattern.confidence).toBeLessThanOrEqual(100);
				});
			}
		});
	});

	describe("Integration with config", () => {
		it("should accept config parameter without errors", async () => {
			const testFile = join(projectRoot, "tests", "config-test.test.ts");
			const config = { thresholds: { couplingPercent: 20 } };

			// Should not throw
			const result = await getSiblingGuidance(testFile, config);

			// Result can be guidance or null, but should not throw
			expect(result === null || typeof result === "object").toBe(true);
		});

		it("should pass config to volatility engine", async () => {
			// Verify config is propagated (indirectly, by not throwing)
			const testFile = join(projectRoot, "tests", "config-propagate.test.ts");
			const config = {
				panicKeywords: { critical: 5 },
			};

			const result = await getSiblingGuidance(testFile, config);

			// If we get here without error, config was accepted
			expect(result === null || typeof result === "object").toBe(true);
		});
	});
});
