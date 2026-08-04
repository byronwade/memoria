import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cache,
	getCoupledFiles,
	getRepoChangeFrequency,
} from "../src/index.js";
import { TempGitRepo } from "./helpers/temp-git-repo.js";

/**
 * Association-rule LIFT correction (Zimmermann et al., TSE 2005).
 *
 * Fixture:
 *   c1..c3: a.ts + b.ts + common.ts   (a and b are true partners)
 *   c4..c6: x/y/z + common.ts         (common.ts changes with everything)
 */
describe("Entanglement engine — lift correction", () => {
	let repo: TempGitRepo;
	let aPath: string;

	beforeEach(async () => {
		cache.clear();
		repo = await TempGitRepo.create("memoria-lift-test-");

		await repo.commit("feat a/b 1", {
			"a.ts": "a1",
			"b.ts": "b1",
			"common.ts": "k1",
		});
		await repo.commit("feat a/b 2", {
			"a.ts": "a2",
			"b.ts": "b2",
			"common.ts": "k2",
		});
		await repo.commit("feat a/b 3", {
			"a.ts": "a3",
			"b.ts": "b3",
			"common.ts": "k3",
		});
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
		expect(freq.fileFreq.get("common.ts")).toBe(6);
		expect(freq.fileFreq.get("a.ts")).toBe(3);
		expect(freq.fileFreq.get("b.ts")).toBe(3);
	});

	it("keeps the genuine partner (lift > 1) and reports support", async () => {
		const result = await getCoupledFiles(aPath, {
			thresholds: { minLift: 1.5, minSupport: 2 },
		});
		const b = result.find((r) => r.file === "b.ts");
		expect(b).toBeDefined();
		expect(b!.support).toBe(3);
		expect(b!.lift!).toBeGreaterThan(1.5);
		expect(b!.score).toBe(100);
	});

	it("drops the coincidental changes-with-everything file via lift", async () => {
		const result = await getCoupledFiles(aPath, {
			thresholds: { minLift: 1.5, minSupport: 2 },
		});
		expect(result.find((r) => r.file === "common.ts")).toBeUndefined();
	});

	it("raw confidence alone would not distinguish them (proves lift is necessary)", async () => {
		const result = await getCoupledFiles(aPath, {
			thresholds: { minLift: 0, minSupport: 2 },
		});
		const b = result.find((r) => r.file === "b.ts");
		const common = result.find((r) => r.file === "common.ts");
		expect(b?.score).toBe(common?.score);
		expect(common!.lift!).toBeLessThan(b!.lift!);
	});

	it("enforces minimum support (a single shared commit is noise)", async () => {
		await repo.commit("one-off", { "a.ts": "a4", "w.ts": "w1" });
		cache.clear();
		const result = await getCoupledFiles(aPath, {
			thresholds: { minLift: 0, minSupport: 2 },
		});
		expect(result.find((r) => r.file === "w.ts")).toBeUndefined();
	});
});
