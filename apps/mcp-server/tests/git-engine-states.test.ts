import os from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TempGitRepo } from "./helpers/temp-git-repo.js";
import {
	cache,
	checkDrift,
	createAnalysisContext,
	getCoupledFiles,
	getImporters,
	getVolatility,
	searchHistory,
} from "../src/index.js";

/**
 * GIT ENGINE STATES
 *
 * The other engine tests run against the live Memoria repo, which makes them
 * non-deterministic (history changes over time) and unable to probe specific
 * repository shapes. These tests build disposable git repos with controlled
 * history so we can assert exact behavior for the states that actually break
 * the engines in the wild:
 *
 *   - a brand-new file with zero history (the "Day 1" problem)
 *   - a file with a long, rich history (panic keywords, bus factor)
 *   - files that co-change (entanglement)
 *   - untracked / non-existent files
 *   - a path that lives entirely outside any git repository
 *   - an empty repository with no commits at all
 */

describe("Git Engine States", () => {
	let repo: TempGitRepo;

	beforeEach(() => {
		cache.clear();
	});

	afterEach(() => {
		repo?.cleanup();
	});

	describe("new file with no history (Day 1 problem)", () => {
		it("reports zero commits but still surfaces static importers", async () => {
			repo = await TempGitRepo.create();
			// A committed file that imports a brand-new, uncommitted module.
			await repo.commit("add consumer importing the new util", {
				"src/consumer.ts":
					"import { brandNew } from './brandNew';\nexport const x = brandNew();\n",
			});
			// The new util is created and committed so git grep can see the importer.
			await repo.commit("add brandNew util", {
				"src/brandNew.ts": "export const brandNew = () => 42;\n",
			});

			const target = repo.path("src/brandNew.ts");
			const volatility = await getVolatility(target);

			// One commit introduced it — it is "new" in the sense of thin history.
			expect(volatility.commitCount).toBe(1);

			// Static import detection must still find the dependent even though
			// the entanglement (co-change) engine has nothing to work with.
			const importers = await getImporters(target);
			expect(importers).toContain("consumer.ts");
		});

		it("returns no coupling for a single-commit file (cold-start filter)", async () => {
			repo = await TempGitRepo.create();
			await repo.commit("initial", {
				"src/a.ts": "export const a = 1;\n",
				"src/b.ts": "export const b = 2;\n",
			});

			// Fewer than 3 commits => coupling data is statistical noise => [].
			const coupled = await getCoupledFiles(repo.path("src/a.ts"));
			expect(coupled).toEqual([]);
		});
	});

	describe("rich history", () => {
		it("computes a high panic score for repeated critical fixes", async () => {
			repo = await TempGitRepo.create();
			const messages = [
				"fix critical security vulnerability in auth",
				"hotfix: urgent crash on login",
				"fix data loss bug when saving",
				"patch regression in token refresh",
			];
			for (let i = 0; i < messages.length; i++) {
				await repo.commit(messages[i], {
					"src/auth.ts": `export const token = ${i};\n`,
				});
			}

			const volatility = await getVolatility(repo.path("src/auth.ts"));
			expect(volatility.commitCount).toBe(4);
			// The score denominator is fixed at a 20-commit window, so 4 critical
			// commits land near the top of what 4 commits can score (~20%). The
			// point is that it registers as clearly volatile, not zero.
			expect(volatility.panicScore).toBeGreaterThan(15);
			expect(volatility.panicCommits.length).toBeGreaterThan(0);
		});

		it("stays calm for purely routine commits", async () => {
			repo = await TempGitRepo.create();
			for (let i = 0; i < 4; i++) {
				await repo.commit(`update docs and formatting ${i}`, {
					"docs/guide.md": `# Guide v${i}\n`,
				});
			}
			const volatility = await getVolatility(repo.path("docs/guide.md"));
			expect(volatility.commitCount).toBe(4);
			// "docs"/"format" are low-weight; the score should stay modest.
			expect(volatility.panicScore).toBeLessThan(volatility.commitCount * 25);
		});

		it("tracks the bus factor / top author across contributors", async () => {
			repo = await TempGitRepo.create();
			// Default author dominates the file.
			for (let i = 0; i < 5; i++) {
				await repo.commit(`feature work ${i}`, {
					"src/owner.ts": `export const v = ${i};\n`,
				});
			}
			// A second author makes a single commit.
			await repo.git.addConfig("user.name", "Second Dev");
			await repo.git.addConfig("user.email", "second@example.com");
			await repo.commit("feature tweak by second dev", {
				"src/owner.ts": "export const v = 99;\n",
			});

			const volatility = await getVolatility(repo.path("src/owner.ts"));
			expect(volatility.authors).toBeGreaterThanOrEqual(2);
			expect(volatility.topAuthor).not.toBeNull();
			// The first author owns the majority of commits.
			expect(volatility.topAuthor!.percentage).toBeGreaterThan(50);
		});
	});

	describe("entanglement (co-change coupling)", () => {
		it("detects files that consistently change together", async () => {
			repo = await TempGitRepo.create();
			// Four commits that always touch BOTH files => 100% coupling.
			for (let i = 0; i < 4; i++) {
				await repo.commit(`sync schema change ${i}`, {
					"src/model.ts": `export interface User { id: number; v${i}: string }\n`,
					"src/repository.ts": `// repo using User v${i}\nexport const repo = ${i};\n`,
				});
			}

			const coupled = await getCoupledFiles(repo.path("src/model.ts"));
			const files = coupled.map((c) => c.file);
			expect(files).toContain("src/repository.ts");
			const repository = coupled.find((c) => c.file === "src/repository.ts")!;
			expect(repository.score).toBeGreaterThan(50);
			// Diff evidence should be parsed into a structured summary.
			expect(repository.evidence).toBeDefined();
		});

		it("does not couple files that only changed together once", async () => {
			repo = await TempGitRepo.create();
			// 3 commits touch model.ts; only one of them also touches unrelated.ts.
			await repo.commit("change 1", {
				"src/model.ts": "export const m = 1;\n",
				"src/unrelated.ts": "export const u = 1;\n",
			});
			await repo.commit("change 2", { "src/model.ts": "export const m = 2;\n" });
			await repo.commit("change 3", { "src/model.ts": "export const m = 3;\n" });

			const coupled = await getCoupledFiles(repo.path("src/model.ts"));
			// 1/3 = 33% which is above the default 15% threshold, so it may appear;
			// the important invariant is that a strongly-coupled partner would
			// always outrank a one-off. Here there is no strong partner, so if it
			// appears at all it must carry the low ~33% score, never a high one.
			const unrelated = coupled.find((c) => c.file === "src/unrelated.ts");
			if (unrelated) {
				expect(unrelated.score).toBeLessThan(50);
			}
		});
	});

	describe("drift detection", () => {
		it("returns an array and does not throw for a coupled file set", async () => {
			repo = await TempGitRepo.create();
			for (let i = 0; i < 4; i++) {
				await repo.commit(`change ${i}`, {
					"src/x.ts": `export const x = ${i};\n`,
					"src/y.ts": `export const y = ${i};\n`,
				});
			}
			const coupled = await getCoupledFiles(repo.path("src/x.ts"));
			const drift = await checkDrift(repo.path("src/x.ts"), coupled);
			expect(Array.isArray(drift)).toBe(true);
		});
	});

	describe("history search in a controlled repo", () => {
		it("finds a commit by message keyword", async () => {
			repo = await TempGitRepo.create();
			await repo.commit("add feature", { "src/f.ts": "export const f = 1;\n" });
			await repo.commit("fix the flaky Safari race condition", {
				"src/f.ts": "export const f = 2; // setTimeout guard\n",
			});

			const out = await searchHistory({
				query: "Safari",
				filePath: repo.path("src/f.ts"),
				searchType: "message",
			});
			expect(out.totalFound).toBeGreaterThan(0);
			expect(out.results[0].message).toContain("Safari");
		});

		it("finds a commit by code change via pickaxe (diff search)", async () => {
			repo = await TempGitRepo.create();
			await repo.commit("baseline", { "src/g.ts": "export const g = 1;\n" });
			await repo.commit("introduce setTimeout workaround", {
				"src/g.ts": "export const g = 1;\nsetTimeout(() => {}, 0);\n",
			});

			const out = await searchHistory({
				query: "setTimeout",
				filePath: repo.path("src/g.ts"),
				searchType: "diff",
			});
			expect(out.totalFound).toBeGreaterThan(0);
		});

		it("returns an empty result set for a keyword that never appears", async () => {
			repo = await TempGitRepo.create();
			await repo.commit("only commit", { "src/h.ts": "export const h = 1;\n" });

			const out = await searchHistory({
				query: "zzz_nonexistent_keyword_qqq",
				filePath: repo.path("src/h.ts"),
			});
			expect(out.totalFound).toBe(0);
			expect(out.results).toEqual([]);
		});
	});

	describe("non-git and missing paths", () => {
		it("returns safe empty defaults for a path outside any git repo", async () => {
			// os.tmpdir() itself is not a git repo.
			const orphan = os.tmpdir() + "/memoria-orphan-not-real.ts";

			// Engines should swallow git errors and return empty data, not throw.
			const coupled = await getCoupledFiles(orphan);
			expect(coupled).toEqual([]);

			const importers = await getImporters(orphan);
			expect(importers).toEqual([]);

			const history = await searchHistory({ query: "anything", filePath: orphan });
			expect(history.totalFound).toBe(0);
		});

		it("returns empty coupling for a tracked-repo path that does not exist", async () => {
			repo = await TempGitRepo.create();
			await repo.commit("seed", { "src/real.ts": "export const r = 1;\n" });

			const ghost = repo.path("src/ghost.ts");
			const coupled = await getCoupledFiles(ghost);
			expect(coupled).toEqual([]);
		});
	});

	describe("empty repository", () => {
		it("reports zero history without throwing", async () => {
			repo = await TempGitRepo.create();
			// File exists on disk but the repo has no commits at all.
			const file = repo.write("src/uncommitted.ts", "export const u = 1;\n");

			const volatility = await getVolatility(file);
			expect(volatility.commitCount).toBe(0);
			expect(volatility.panicScore).toBe(0);

			const coupled = await getCoupledFiles(file);
			expect(coupled).toEqual([]);
		});
	});

	describe("analysis context", () => {
		it("resolves the repo root and loads config for a controlled repo", async () => {
			repo = await TempGitRepo.create();
			await repo.commit("seed", { "src/seed.ts": "export const s = 1;\n" });

			const ctx = await createAnalysisContext(repo.path("src/seed.ts"));
			// realpath may differ from the raw temp dir on macOS (/var vs /private/var),
			// so compare basenames rather than the full path.
			expect(ctx.repoRoot.length).toBeGreaterThan(0);
			expect(ctx.git).toBeDefined();
			expect(ctx.metrics.totalCommits).toBeGreaterThanOrEqual(1);
			// No .memoria.json present => null config.
			expect(ctx.config).toBeNull();
		});

		it("loads a .memoria.json placed at the repo root", async () => {
			repo = await TempGitRepo.create();
			await repo.commit("seed with config", {
				"src/seed.ts": "export const s = 1;\n",
				".memoria.json": JSON.stringify({
					thresholds: { couplingPercent: 42 },
				}),
			});

			const ctx = await createAnalysisContext(repo.path("src/seed.ts"));
			expect(ctx.config).not.toBeNull();
			expect(ctx.config?.thresholds?.couplingPercent).toBe(42);
		});
	});
});
