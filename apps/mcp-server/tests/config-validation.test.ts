import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cache,
	getStableConfigKey,
	loadConfig,
	type MemoriaConfig,
} from "../src/index.js";

/**
 * CONFIG VALIDATION EDGE CASES
 *
 * config-loader.test.ts covers the happy paths and a couple of rejections.
 * This file pins down the boundary behavior of the zod schema — the exact
 * places where a malformed `.memoria.json` must be rejected (and fall back to
 * defaults) rather than silently corrupting the analysis weights/thresholds.
 *
 * Each case writes a real file into a fresh temp dir and exercises the public
 * `loadConfig`, so it also guards the "invalid config => null, never throw"
 * contract that the engines depend on.
 */

describe("Config Validation", () => {
	let dir: string;

	beforeEach(() => {
		cache.clear();
		dir = mkdtempSync(join(os.tmpdir(), "memoria-config-test-"));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	async function writeAndLoad(raw: unknown): Promise<MemoriaConfig | null> {
		const content =
			typeof raw === "string" ? raw : JSON.stringify(raw);
		writeFileSync(join(dir, ".memoria.json"), content);
		return loadConfig(dir);
	}

	describe("threshold bounds", () => {
		it("accepts couplingPercent at the boundaries (0 and 100)", async () => {
			expect(
				(await writeAndLoad({ thresholds: { couplingPercent: 0 } }))?.thresholds
					?.couplingPercent,
			).toBe(0);
			cache.clear();
			expect(
				(await writeAndLoad({ thresholds: { couplingPercent: 100 } }))
					?.thresholds?.couplingPercent,
			).toBe(100);
		});

		it("rejects a negative couplingPercent", async () => {
			expect(await writeAndLoad({ thresholds: { couplingPercent: -1 } })).toBeNull();
		});

		it("rejects driftDays below the minimum of 1", async () => {
			expect(await writeAndLoad({ thresholds: { driftDays: 0 } })).toBeNull();
		});

		it("rejects driftDays above the maximum of 365", async () => {
			expect(await writeAndLoad({ thresholds: { driftDays: 400 } })).toBeNull();
		});

		it("rejects analysisWindow below the minimum of 10", async () => {
			expect(
				await writeAndLoad({ thresholds: { analysisWindow: 5 } }),
			).toBeNull();
		});

		it("accepts maxFilesPerCommit within range", async () => {
			const cfg = await writeAndLoad({
				thresholds: { maxFilesPerCommit: 25 },
			});
			expect(cfg?.thresholds?.maxFilesPerCommit).toBe(25);
		});

		it("rejects maxFilesPerCommit below the minimum of 5", async () => {
			expect(
				await writeAndLoad({ thresholds: { maxFilesPerCommit: 1 } }),
			).toBeNull();
		});
	});

	describe("risk weights", () => {
		it("accepts weights at the 0 and 1 boundaries", async () => {
			const cfg = await writeAndLoad({
				riskWeights: { volatility: 0, coupling: 1 },
			});
			expect(cfg?.riskWeights?.volatility).toBe(0);
			expect(cfg?.riskWeights?.coupling).toBe(1);
		});

		it("rejects a weight greater than 1", async () => {
			expect(
				await writeAndLoad({ riskWeights: { volatility: 1.5 } }),
			).toBeNull();
		});

		it("rejects a negative weight", async () => {
			expect(await writeAndLoad({ riskWeights: { drift: -0.1 } })).toBeNull();
		});
	});

	describe("structural validation", () => {
		it("accepts an empty config object (all fields optional)", async () => {
			expect(await writeAndLoad({})).toEqual({});
		});

		it("rejects panicKeywords whose values are not numbers", async () => {
			expect(
				await writeAndLoad({ panicKeywords: { outage: "high" } }),
			).toBeNull();
		});

		it("accepts a valid panicKeywords map", async () => {
			const cfg = await writeAndLoad({ panicKeywords: { p0: 3, sev1: 2.5 } });
			expect(cfg?.panicKeywords?.p0).toBe(3);
		});

		it("rejects ignore that is not an array of strings", async () => {
			expect(await writeAndLoad({ ignore: "migrations/**" })).toBeNull();
		});

		it("rejects unknown top-level keys (strict mode)", async () => {
			expect(await writeAndLoad({ extra: true })).toBeNull();
		});

		it("rejects malformed JSON without throwing", async () => {
			expect(await writeAndLoad("{ not valid json ")).toBeNull();
		});

		it("returns null when the config file is absent", async () => {
			// Fresh dir, no file written.
			expect(await loadConfig(dir)).toBeNull();
		});
	});

	describe("getStableConfigKey", () => {
		it("returns an empty string for null/undefined config", () => {
			expect(getStableConfigKey(null)).toBe("");
			expect(getStableConfigKey(undefined)).toBe("");
		});

		it("is deterministic regardless of panicKeyword insertion order", () => {
			const a = getStableConfigKey({ panicKeywords: { b: 1, a: 2, c: 3 } });
			const b = getStableConfigKey({ panicKeywords: { c: 3, a: 2, b: 1 } });
			expect(a).toBe(b);
		});

		it("produces different keys for different thresholds", () => {
			const a = getStableConfigKey({ thresholds: { couplingPercent: 10 } });
			const b = getStableConfigKey({ thresholds: { couplingPercent: 20 } });
			expect(a).not.toBe(b);
		});

		it("encodes missing threshold fields as a stable placeholder", () => {
			const key = getStableConfigKey({ thresholds: { couplingPercent: 10 } });
			// driftDays and analysisWindow are absent -> 'x' placeholders.
			expect(key).toContain("cp10");
			expect(key).toContain("ddx");
			expect(key).toContain("awx");
		});
	});
});
