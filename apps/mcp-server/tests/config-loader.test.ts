import { mkdir, rmdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
	let getEffectiveThresholds: (config: any) => any;
	let loadConfigResult: (repoRoot: string) => Promise<any>;
	let getConfigWarnings: (config: any) => string[];
	let DEFAULT_THRESHOLDS: any;
	let DEFAULT_RISK_WEIGHTS: any;
	let DEFAULT_CONFIG: any;
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
		getEffectiveThresholds = module.getEffectiveThresholds;
		loadConfigResult = module.loadConfigResult;
		getConfigWarnings = module.getConfigWarnings;
		DEFAULT_THRESHOLDS = module.DEFAULT_THRESHOLDS;
		DEFAULT_RISK_WEIGHTS = module.DEFAULT_RISK_WEIGHTS;
		DEFAULT_CONFIG = module.DEFAULT_CONFIG;
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
			const cacheKey = `config-result:${tempDir}`;
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

	describe("default constants (single source of truth)", () => {
		it("should expose threshold defaults", () => {
			expect(DEFAULT_THRESHOLDS.couplingPercent).toBe(15);
			expect(DEFAULT_THRESHOLDS.driftDays).toBe(7);
			expect(DEFAULT_THRESHOLDS.analysisWindow).toBe(50);
			expect(DEFAULT_THRESHOLDS.maxFilesPerCommit).toBe(15);
		});

		it("should expose risk weight defaults that sum to 1.0", () => {
			const sum =
				DEFAULT_RISK_WEIGHTS.volatility +
				DEFAULT_RISK_WEIGHTS.coupling +
				DEFAULT_RISK_WEIGHTS.drift +
				DEFAULT_RISK_WEIGHTS.importers;
			expect(sum).toBeCloseTo(1.0, 5);
		});

		it("getEffectiveRiskWeights(null) should equal DEFAULT_RISK_WEIGHTS", () => {
			expect(getEffectiveRiskWeights(null)).toEqual({ ...DEFAULT_RISK_WEIGHTS });
		});

		it("getAdaptiveThresholds base case should match DEFAULT_THRESHOLDS", () => {
			const result = getAdaptiveThresholds({
				totalCommits: 100,
				commitsPerWeek: 10,
				avgFilesPerCommit: 3,
			});
			expect(result.couplingThreshold).toBe(DEFAULT_THRESHOLDS.couplingPercent);
			expect(result.driftDays).toBe(DEFAULT_THRESHOLDS.driftDays);
			expect(result.analysisWindow).toBe(DEFAULT_THRESHOLDS.analysisWindow);
		});

		it("DEFAULT_CONFIG should embed the default thresholds and weights", () => {
			expect(DEFAULT_CONFIG.thresholds).toEqual({ ...DEFAULT_THRESHOLDS });
			expect(DEFAULT_CONFIG.riskWeights).toEqual({ ...DEFAULT_RISK_WEIGHTS });
		});
	});

	describe("getEffectiveThresholds", () => {
		it("should return defaults when config is null", () => {
			expect(getEffectiveThresholds(null)).toEqual({ ...DEFAULT_THRESHOLDS });
		});

		it("should merge partial overrides with defaults", () => {
			const result = getEffectiveThresholds({
				thresholds: { couplingPercent: 30 },
			});
			expect(result.couplingPercent).toBe(30);
			expect(result.driftDays).toBe(DEFAULT_THRESHOLDS.driftDays);
			expect(result.maxFilesPerCommit).toBe(DEFAULT_THRESHOLDS.maxFilesPerCommit);
		});
	});

	describe("loadConfigResult (status-aware loading)", () => {
		it("should report 'missing' when no file exists", async () => {
			const result = await loadConfigResult(projectRoot);
			expect(result.status).toBe("missing");
			expect(result.config).toBeNull();
		});

		it("should report 'ok' with warnings array for valid config", async () => {
			await writeFile(
				configPath,
				JSON.stringify({ thresholds: { couplingPercent: 20 } }),
			);
			const result = await loadConfigResult(tempDir);
			expect(result.status).toBe("ok");
			expect(result.config?.thresholds?.couplingPercent).toBe(20);
			expect(Array.isArray(result.warnings)).toBe(true);
		});

		it("should report 'invalid' with JSON parse error", async () => {
			await writeFile(configPath, "{ not json }");
			const result = await loadConfigResult(tempDir);
			expect(result.status).toBe("invalid");
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors[0]).toMatch(/JSON/i);
		});

		it("should report 'invalid' with helpful message for unknown option", async () => {
			await writeFile(configPath, JSON.stringify({ thresholdz: {} }));
			const result = await loadConfigResult(tempDir);
			expect(result.status).toBe("invalid");
			expect(result.errors.join(" ")).toMatch(/Unknown option/);
			expect(result.errors.join(" ")).toContain("thresholdz");
		});

		it("should report 'invalid' with type info for wrong types", async () => {
			await writeFile(
				configPath,
				JSON.stringify({ thresholds: { couplingPercent: "nope" } }),
			);
			const result = await loadConfigResult(tempDir);
			expect(result.status).toBe("invalid");
			expect(result.errors.join(" ")).toMatch(/couplingPercent/);
		});

		it("should catch unknown nested keys (strict nested objects)", async () => {
			await writeFile(
				configPath,
				JSON.stringify({ thresholds: { couplingPct: 20 } }),
			);
			const result = await loadConfigResult(tempDir);
			expect(result.status).toBe("invalid");
			expect(result.errors.join(" ")).toContain("couplingPct");
		});
	});

	describe("getConfigWarnings", () => {
		it("should warn when risk weights do not sum to 1.0", () => {
			const warnings = getConfigWarnings({
				riskWeights: { volatility: 0.5, coupling: 0.5, drift: 0.5, importers: 0.5 },
			});
			expect(warnings.some((w) => w.includes("riskWeights sum"))).toBe(true);
		});

		it("should not warn when risk weights sum to ~1.0", () => {
			const warnings = getConfigWarnings({
				riskWeights: { volatility: 0.35, coupling: 0.3, drift: 0.2, importers: 0.15 },
			});
			expect(warnings.some((w) => w.includes("riskWeights sum"))).toBe(false);
		});

		it("should warn about negative panic keyword weights", () => {
			const warnings = getConfigWarnings({ panicKeywords: { foo: -1 } });
			expect(warnings.some((w) => w.includes("negative weight"))).toBe(true);
		});

		it("should return no warnings for a clean config", () => {
			expect(getConfigWarnings({ thresholds: { couplingPercent: 20 } })).toEqual([]);
		});
	});

	describe("loadConfig surfaces invalid config (no silent swallow)", () => {
		it("should warn to stderr when config is invalid, then return null", async () => {
			await writeFile(configPath, JSON.stringify({ bogusKey: true }));
			const errors: string[] = [];
			const spy = vi.spyOn(console, "error").mockImplementation((...a) => {
				errors.push(a.join(" "));
			});
			try {
				const result = await loadConfig(tempDir);
				expect(result).toBeNull();
				expect(errors.join("\n")).toMatch(/invalid \.memoria\.json/i);
				expect(errors.join("\n")).toContain("bogusKey");
			} finally {
				spy.mockRestore();
			}
		});

		it("should NOT warn when config file is simply missing", async () => {
			const spy = vi.spyOn(console, "error").mockImplementation(() => {});
			try {
				const result = await loadConfig(projectRoot);
				expect(result).toBeNull();
				expect(spy).not.toHaveBeenCalled();
			} finally {
				spy.mockRestore();
			}
		});
	});
});
