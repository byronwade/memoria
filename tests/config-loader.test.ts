import { mkdir, rmdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Get project root for test fixtures
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Config Loader (.memoria.json)", () => {
	let loadConfig: (repoRoot: string) => Promise<any>;
	let getEffectivePanicKeywords: (config: any) => Record<string, number>;
	let getEffectiveRiskWeights: (config: any) => {
		volatility: number;
		coupling: number;
		drift: number;
		importers: number;
	};
	let getAdaptiveThresholds: (metrics: any, config?: any) => any;
	let PANIC_KEYWORDS: Record<string, number>;
	let cache: any;

	// Temp directory for test configs
	const tempDir = join(projectRoot, "test-temp-config");
	const configPath = join(tempDir, ".memoria.json");

	beforeEach(async () => {
		const module = await import("../src/index.js");
		loadConfig = module.loadConfig;
		getEffectivePanicKeywords = module.getEffectivePanicKeywords;
		getEffectiveRiskWeights = module.getEffectiveRiskWeights;
		getAdaptiveThresholds = module.getAdaptiveThresholds;
		PANIC_KEYWORDS = module.PANIC_KEYWORDS;
		cache = module.cache;
		cache.clear();

		// Create temp directory
		try {
			await mkdir(tempDir, { recursive: true });
		} catch {
			// Directory might already exist
		}
	});

	afterEach(async () => {
		// Clean up temp files
		try {
			await unlink(configPath);
		} catch {
			// File might not exist
		}
		try {
			await rmdir(tempDir);
		} catch {
			// Directory might not exist or not empty
		}
	});

	describe("loadConfig", () => {
		it("should return null for non-existent config file", async () => {
			const result = await loadConfig(projectRoot);
			expect(result).toBeNull();
		});

		it("should load and parse valid config file", async () => {
			const config = {
				thresholds: { couplingPercent: 20, driftDays: 14 },
			};
			await writeFile(configPath, JSON.stringify(config));

			const result = await loadConfig(tempDir);
			expect(result).not.toBeNull();
			expect(result?.thresholds?.couplingPercent).toBe(20);
			expect(result?.thresholds?.driftDays).toBe(14);
		});

		it("should cache config results", async () => {
			const config = { thresholds: { couplingPercent: 25 } };
			await writeFile(configPath, JSON.stringify(config));

			// First call
			const result1 = await loadConfig(tempDir);

			// Verify it's in cache
			const cacheKey = `config:${tempDir}`;
			expect(cache.has(cacheKey)).toBe(true);

			// Second call should return cached result
			const result2 = await loadConfig(tempDir);
			expect(result2).toEqual(result1);
		});

		it("should return null for invalid JSON", async () => {
			await writeFile(configPath, "{ invalid json }");
			const result = await loadConfig(tempDir);
			expect(result).toBeNull();
		});

		it("should return null for config with invalid schema", async () => {
			const config = {
				thresholds: { couplingPercent: "not a number" },
			};
			await writeFile(configPath, JSON.stringify(config));

			const result = await loadConfig(tempDir);
			expect(result).toBeNull();
		});

		it("should validate threshold ranges", async () => {
			// Invalid coupling percent (> 100)
			const config = { thresholds: { couplingPercent: 150 } };
			await writeFile(configPath, JSON.stringify(config));

			const result = await loadConfig(tempDir);
			expect(result).toBeNull();
		});

		it("should accept all valid config options", async () => {
			const config = {
				thresholds: {
					couplingPercent: 25,
					driftDays: 10,
					analysisWindow: 75,
				},
				ignore: ["migrations/**", "generated/**"],
				panicKeywords: { p0: 3, outage: 2.5 },
				riskWeights: {
					volatility: 0.4,
					coupling: 0.25,
					drift: 0.2,
					importers: 0.15,
				},
			};
			await writeFile(configPath, JSON.stringify(config));

			const result = await loadConfig(tempDir);
			expect(result).not.toBeNull();
			expect(result?.thresholds?.couplingPercent).toBe(25);
			expect(result?.ignore).toHaveLength(2);
			expect(result?.panicKeywords?.p0).toBe(3);
			expect(result?.riskWeights?.volatility).toBe(0.4);
		});

		it("should reject unknown properties (strict mode)", async () => {
			const config = {
				unknownProperty: "should fail",
			};
			await writeFile(configPath, JSON.stringify(config));

			const result = await loadConfig(tempDir);
			expect(result).toBeNull();
		});
	});

	describe("getEffectivePanicKeywords", () => {
		it("should return base keywords when config is null", () => {
			const result = getEffectivePanicKeywords(null);
			expect(result).toEqual(PANIC_KEYWORDS);
		});

		it("should return base keywords when config has no panicKeywords", () => {
			const config = { thresholds: { couplingPercent: 20 } };
			const result = getEffectivePanicKeywords(config);
			expect(result).toEqual(PANIC_KEYWORDS);
		});

		it("should merge config keywords with base keywords", () => {
			const config = { panicKeywords: { p0: 3, outage: 2.5 } };
			const result = getEffectivePanicKeywords(config);

			// Base keywords should still exist
			expect(result.security).toBe(3);
			expect(result.fix).toBe(1);

			// Custom keywords should be added
			expect(result.p0).toBe(3);
			expect(result.outage).toBe(2.5);
		});

		it("should allow overriding base keywords", () => {
			const config = { panicKeywords: { fix: 2 } };
			const result = getEffectivePanicKeywords(config);

			// Override should win
			expect(result.fix).toBe(2);
		});
	});

	describe("getEffectiveRiskWeights", () => {
		it("should return default weights when config is null", () => {
			const result = getEffectiveRiskWeights(null);
			expect(result.volatility).toBe(0.35);
			expect(result.coupling).toBe(0.3);
			expect(result.drift).toBe(0.2);
			expect(result.importers).toBe(0.15);
		});

		it("should return default weights when config has no riskWeights", () => {
			const config = { thresholds: { couplingPercent: 20 } };
			const result = getEffectiveRiskWeights(config);
			expect(result.volatility).toBe(0.35);
		});

		it("should use config weights when provided", () => {
			const config = {
				riskWeights: {
					volatility: 0.5,
					coupling: 0.2,
					drift: 0.2,
					importers: 0.1,
				},
			};
			const result = getEffectiveRiskWeights(config);
			expect(result.volatility).toBe(0.5);
			expect(result.coupling).toBe(0.2);
			expect(result.drift).toBe(0.2);
			expect(result.importers).toBe(0.1);
		});

		it("should use defaults for missing weights", () => {
			const config = { riskWeights: { volatility: 0.5 } };
			const result = getEffectiveRiskWeights(config);
			expect(result.volatility).toBe(0.5);
			expect(result.coupling).toBe(0.3); // Default
			expect(result.drift).toBe(0.2); // Default
			expect(result.importers).toBe(0.15); // Default
		});
	});

	describe("getAdaptiveThresholds with config", () => {
		const defaultMetrics = {
			totalCommits: 100,
			commitsPerWeek: 10,
			avgFilesPerCommit: 3,
		};

		it("should use adaptive thresholds when no config provided", () => {
			const result = getAdaptiveThresholds(defaultMetrics);
			expect(result.couplingThreshold).toBe(15); // Base for normal velocity
			expect(result.driftDays).toBe(7);
			expect(result.analysisWindow).toBe(50);
		});

		it("should override thresholds with config values", () => {
			const config = {
				thresholds: {
					couplingPercent: 25,
					driftDays: 14,
					analysisWindow: 100,
				},
			};
			const result = getAdaptiveThresholds(defaultMetrics, config);
			expect(result.couplingThreshold).toBe(25);
			expect(result.driftDays).toBe(14);
			expect(result.analysisWindow).toBe(100);
		});

		it("should partially override with config values", () => {
			const config = {
				thresholds: { couplingPercent: 30 },
			};
			const result = getAdaptiveThresholds(defaultMetrics, config);
			expect(result.couplingThreshold).toBe(30); // From config
			expect(result.driftDays).toBe(7); // Adaptive default
			expect(result.analysisWindow).toBe(50); // Adaptive default
		});

		it("should apply config overrides regardless of project velocity", () => {
			// High velocity project would normally get couplingThreshold: 10
			const highVelocityMetrics = {
				totalCommits: 1000,
				commitsPerWeek: 100,
				avgFilesPerCommit: 2,
			};
			const config = {
				thresholds: { couplingPercent: 20 },
			};
			const result = getAdaptiveThresholds(highVelocityMetrics, config);
			expect(result.couplingThreshold).toBe(20); // Config wins
		});
	});
});
