import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cache, getCoupledFiles, getRepoChangeFrequency } from "../src/index.js";
import { TempGitRepo } from "./helpers/temp-git-repo.js";

/**
 * Validates the association-rule LIFT correction in the entanglement engine
 * (Zimmermann et al., TSE 2005). Raw co-change % (confidence) flags a file that
 * changes alongside the target — but a file that changes in *every* commit
 * (a hot barrel/constants file) scores high confidence while being coincidental.
 * Lift = confidence / baseRate(Y) corrects this: genuine partners have lift > 1,
 * ubiquitous files have lift ~= 1.
 *
 * Fixture history (all small, non-bulk commits):
 *   c1..c3: a.ts + b.ts + common.ts   (a and b are true partners)
 *   c4..c6: x.ts/y.ts/z.ts + common.ts (common.ts changes with everything)
 *
 * For target a.ts (3 commits):
 *   b.ts:      confidence 3/3=1.0, baseRate 3/6=0.5 -> lift 2.0  (KEEP)
 *   common.ts: confidence 3/3=1.0, baseRate 6/6=1.0 -> lift 1.0  (coincidental)
 */
describe("Entanglement engine — lift correction", () => {
	let repo: TempGitRepo;
	let aPath: string;

	beforeEach(async () => {
		cache.clear();
		repo = await TempGitRepo.create("memoria-lift-test-");

		await repo.commit("feat a/b 1", { "a.ts": "a1", "b.ts": "b1", "common.ts": "k1" });
		await repo.commit("feat a/b 2", { "a.ts": "a2", "b.ts": "b2", "common.ts": "k2" });
		await repo.commit("feat a/b 3", { "a.ts": "a3", "b.ts": "b3", "common.ts": "k3" });
		await repo.commit("chore x", { "x.ts": "x1", "common.ts": "k4" });
		await repo.commit("chore y", { "y.ts": "y1", "common.ts": "k5" });
		await repo.commit("chore z", { "z.ts": "z1", "common.ts": "k6" });

		aPath = repo.path("a.ts");
	});

	afterEach(() => {
		cache.clear();
		repo.cleanup();
	});

	it("computes a base-rate index over non-bulk commits", async () => {
		const freq = await getRepoChangeFrequency(repo.git, repo.dir, 200, 15);
		expect(freq.totalCommits).toBe(6);
		expect(freq.fileFreq.get("common.ts")).toBe(6); // changed in every commit
		expect(freq.fileFreq.get("a.ts")).toBe(3);
		expect(freq.fileFreq.get("b.ts")).toBe(3);
	});

	it("keeps the genuine partner (lift > 1) and reports support", async () => {
		const result = await getCoupledFiles(aPath, {
			thresholds: { minLift: 1.5, minSupport: 2 },
		});
		const b = result.find((r: any) => r.file === "b.ts");
		expect(b).toBeDefined();
		expect(b.support).toBe(3);
		expect(b.lift).toBeGreaterThan(1.5); // ~2.0
		expect(b.score).toBe(100); // confidence: changed in all 3 of a's commits
	});

	it("drops the coincidental 'changes-with-everything' file via lift", async () => {
		const result = await getCoupledFiles(aPath, {
			thresholds: { minLift: 1.5, minSupport: 2 },
		});
		// common.ts has confidence 100% but lift ~1.0 — must be filtered out.
		expect(result.find((r: any) => r.file === "common.ts")).toBeUndefined();
	});

	it("raw confidence alone would NOT distinguish them (proves lift is necessary)", async () => {
		// With lift disabled, both b.ts and common.ts share identical 100% confidence.
		const result = await getCoupledFiles(aPath, {
			thresholds: { minLift: 0, minSupport: 2 },
		});
		const b = result.find((r: any) => r.file === "b.ts");
		const common = result.find((r: any) => r.file === "common.ts");
		expect(b?.score).toBe(common?.score); // same confidence — indistinguishable
		expect(common.lift).toBeLessThan(b.lift); // but lift separates them
	});

	it("enforces minimum support (a single shared commit is noise)", async () => {
		// w.ts co-changes with a.ts exactly once -> support 1 -> filtered at default.
		await repo.commit("one-off", { "a.ts": "a4", "w.ts": "w1" });
		cache.clear();
		const result = await getCoupledFiles(aPath, {
			thresholds: { minLift: 0, minSupport: 2 },
		});
		expect(result.find((r: any) => r.file === "w.ts")).toBeUndefined();
	});
});
