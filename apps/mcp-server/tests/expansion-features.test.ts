import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	toStructuredAnalysis,
	shouldEscalate,
} from "../src/perf/structured-result.js";
import { buildOwnerBrief } from "../src/perf/owner-brief.js";
import {
	extractExportNames,
	detectBreakingChanges,
	breakingHintsFromDiff,
} from "../src/perf/breaking-changes.js";
import {
	discoverPackages,
	findPackageForFile,
	getPackageCoupling,
} from "../src/perf/package-graph.js";
import { findSymbolReferences } from "../src/perf/call-graph.js";
import { evaluateCriticalRiskTests } from "../src/perf/critical-check.js";
import {
	installPostCommitHook,
	packExists,
	startPackWatch,
} from "../src/perf/watch-daemon.js";
import { planEngines, sourceConfidence } from "../src/perf/file-kind.js";

describe("structured analysis + escalate", () => {
	it("builds a machine-readable payload", () => {
		const structured = toStructuredAnalysis(
			{
				filePath: "/repo/src/auth.ts",
				risk: {
					score: 62,
					level: "high",
					factors: ["coupled"],
					action: "check",
				},
				volatility: {
					commitCount: 10,
					panicScore: 40,
					topAuthor: { name: "Ada", percentage: 80 },
				},
				coupled: [
					{
						file: "src/auth.test.ts",
						score: 90,
						source: "test",
						reason: "test file",
						confidence: 0.85,
					},
				],
				importers: ["src/app.ts"],
				drift: [{ file: "src/old.ts", daysOld: 20 }],
				mode: "fast",
				kind: "source",
				enginesRun: ["volatility", "git"],
				elapsedMs: 120,
			},
			{ escalated: true, ownerBrief: "Owner brief", breakingChanges: ["Removed exports: foo"] },
		);

		expect(structured.file).toBe("auth.ts");
		expect(structured.absolutePath).toContain("auth.ts");
		expect(structured.risk.score).toBe(62);
		expect(structured.volatility.topAuthor).toBe("Ada");
		expect(structured.volatility.topAuthorPct).toBe(80);
		expect(structured.escalated).toBe(true);
		expect(structured.breakingChanges).toContain("Removed exports: foo");
	});

	it("escalates fast analysis on high risk or many importers", () => {
		expect(
			shouldEscalate({
				mode: "fast",
				risk: { score: 55, level: "high", factors: [], action: "" },
				importers: [],
			}),
		).toBe(true);

		expect(
			shouldEscalate({
				mode: "fast",
				risk: { score: 10, level: "low", factors: [], action: "" },
				importers: Array.from({ length: 20 }, (_, i) => `f${i}.ts`),
			}),
		).toBe(true);

		expect(
			shouldEscalate({
				mode: "full",
				risk: { score: 90, level: "critical", factors: [], action: "" },
				importers: Array.from({ length: 50 }, (_, i) => `f${i}.ts`),
			}),
		).toBe(false);

		expect(
			shouldEscalate({
				mode: "fast",
				risk: { score: 10, level: "low", factors: [], action: "" },
				importers: ["a.ts"],
			}),
		).toBe(false);
	});
});

describe("owner brief", () => {
	it("returns null below 50% ownership", () => {
		expect(buildOwnerBrief({ name: "Bob", percentage: 40 })).toBeNull();
	});

	it("warns strongly at ≥70%", () => {
		const brief = buildOwnerBrief(
			{ name: "Ada", percentage: 90 },
			{ fileName: "auth.ts" },
		);
		expect(brief).toContain("Ada");
		expect(brief).toContain("90%");
		expect(brief).toContain("high-risk");
	});

	it("gives soft guidance at 50–69%", () => {
		const brief = buildOwnerBrief({ name: "Ada", percentage: 55 });
		expect(brief).toContain("owns 55%");
		expect(brief).not.toContain("high-risk");
	});
});

describe("breaking change detector", () => {
	it("extracts export names", () => {
		const names = extractExportNames(`
			export function foo() {}
			export const bar = 1;
			export type Baz = string;
			export { qux as renamed };
		`);
		expect(names).toContain("foo");
		expect(names).toContain("bar");
		expect(names).toContain("Baz");
		expect(names).toContain("renamed");
	});

	it("detects removed and added exports", () => {
		const prev = `export function keep() {}\nexport function gone() {}`;
		const curr = `export function keep() {}\nexport function fresh() {}`;
		const report = detectBreakingChanges(curr, prev);
		expect(report.removedExports).toEqual(["gone"]);
		expect(report.addedExports).toEqual(["fresh"]);
		expect(report.summary.some((s) => s.includes("Removed"))).toBe(true);
	});

	it("returns empty when no previous source", () => {
		expect(detectBreakingChanges("export const a = 1", null).summary).toEqual(
			[],
		);
	});

	it("surfaces hints from diff evidence", () => {
		const hints = breakingHintsFromDiff({
			hasBreakingChange: true,
			removals: ["export function legacy() {"],
		});
		expect(hints.length).toBeGreaterThan(0);
	});
});

describe("package graph coupling", () => {
	let tmp: string;

	afterEach(() => {
		if (tmp) rmSync(tmp, { recursive: true, force: true });
	});

	it("discovers workspace packages and couples dependents", async () => {
		tmp = mkdtempSync(join(tmpdir(), "memoria-pkg-"));
		writeFileSync(
			join(tmp, "package.json"),
			JSON.stringify({
				name: "root",
				workspaces: ["packages/*"],
			}),
		);
		mkdirSync(join(tmp, "packages", "core"), { recursive: true });
		mkdirSync(join(tmp, "packages", "app"), { recursive: true });
		writeFileSync(
			join(tmp, "packages", "core", "package.json"),
			JSON.stringify({ name: "@demo/core", version: "1.0.0" }),
		);
		writeFileSync(
			join(tmp, "packages", "app", "package.json"),
			JSON.stringify({
				name: "@demo/app",
				version: "1.0.0",
				dependencies: { "@demo/core": "1.0.0" },
			}),
		);
		writeFileSync(join(tmp, "packages", "core", "index.ts"), "export const x = 1;\n");

		const packages = await discoverPackages(tmp);
		expect(packages.some((p) => p.name === "@demo/core")).toBe(true);
		expect(packages.some((p) => p.name === "@demo/app")).toBe(true);

		const coreFile = join(tmp, "packages", "core", "index.ts");
		const self = findPackageForFile(packages, coreFile, tmp);
		expect(self?.name).toBe("@demo/core");

		const hits = await getPackageCoupling({
			git: {} as never,
			repoRoot: tmp,
			filePath: coreFile,
			packages,
		});
		expect(hits.some((h) => h.file.includes("app") && h.source === "package")).toBe(
			true,
		);
		expect(hits[0].confidence).toBeGreaterThan(0.5);
	});
});

describe("call-graph enhancer", () => {
	let tmp: string;

	afterEach(() => {
		if (tmp) rmSync(tmp, { recursive: true, force: true });
	});

	it("finds symbol references via TS AST or regex", async () => {
		tmp = mkdtempSync(join(tmpdir(), "memoria-cg-"));
		const src = join(tmp, "lib.ts");
		const consumer = join(tmp, "consumer.ts");
		writeFileSync(src, "export function greet(name: string) { return name; }\n");
		writeFileSync(
			consumer,
			`import { greet } from "./lib.js";\nconsole.log(greet("hi"));\n`,
		);

		const hits = await findSymbolReferences({
			repoRoot: tmp,
			filePath: src,
			sourceContent: "export function greet() {}",
			symbols: ["greet"],
			candidateFiles: ["consumer.ts"],
		});

		expect(hits.length).toBe(1);
		expect(hits[0].file).toBe("consumer.ts");
		expect(hits[0].symbols).toContain("greet");
		expect(hits[0].source).toBe("symbol");
	});
});

describe("critical risk CI check", () => {
	it("passes when critical files have test coupling", () => {
		const result = evaluateCriticalRiskTests([
			{
				filePath: "src/auth.ts",
				risk: { score: 80 },
				coupled: [{ source: "test" }, { source: "git" }],
			},
		]);
		expect(result.ok).toBe(true);
		expect(result.checked).toBe(1);
	});

	it("fails when critical files lack test coupling", () => {
		const result = evaluateCriticalRiskTests([
			{
				filePath: "src/auth.ts",
				risk: { score: 90 },
				coupled: [{ source: "git" }],
			},
			{
				filePath: "src/safe.ts",
				risk: { score: 10 },
				coupled: [],
			},
		]);
		expect(result.ok).toBe(false);
		expect(result.failures).toHaveLength(1);
		expect(result.failures[0].file).toContain("auth.ts");
	});

	it("skips files that are themselves tests", () => {
		const result = evaluateCriticalRiskTests([
			{
				filePath: "src/auth.test.ts",
				risk: { score: 99 },
				coupled: [],
			},
		]);
		expect(result.ok).toBe(true);
	});
});

describe("watch daemon + post-commit hook", () => {
	let tmp: string;

	afterEach(() => {
		if (tmp) rmSync(tmp, { recursive: true, force: true });
	});

	it("installs a post-commit hook with memoria marker", async () => {
		tmp = mkdtempSync(join(tmpdir(), "memoria-hook-"));
		mkdirSync(join(tmp, ".git", "hooks"), { recursive: true });
		const hookPath = await installPostCommitHook(tmp);
		expect(hookPath).toContain("post-commit");
		const { readFileSync } = await import("node:fs");
		const content = readFileSync(hookPath, "utf8");
		expect(content).toContain("memoria-pack-hook");
		expect(content).toContain("memoria pack");

		// Idempotent
		await installPostCommitHook(tmp);
		const again = readFileSync(hookPath, "utf8");
		expect(again.match(/memoria-pack-hook/g)?.length).toBe(1);
	});

	it("reports missing pack", async () => {
		tmp = mkdtempSync(join(tmpdir(), "memoria-pack-"));
		expect(await packExists(tmp)).toBe(false);
	});

	it("startPackWatch can be stopped", async () => {
		tmp = mkdtempSync(join(tmpdir(), "memoria-watch-"));
		mkdirSync(join(tmp, ".git"), { recursive: true });
		// Not a real git repo — refresh may error; we just ensure stop works.
		const { stop } = startPackWatch({
			repoRoot: tmp,
			intervalMs: 50_000,
			refreshPack: async () => 0,
		});
		stop();
		expect(true).toBe(true);
	});
});

describe("engine plan includes package", () => {
	it("runs package engine in full mode for source files", () => {
		const full = planEngines("source", "full");
		expect(full.run.has("package")).toBe(true);
		expect(sourceConfidence("package")).toBeGreaterThan(0.7);
	});

	it("skips package engine for docs/config", () => {
		const docs = planEngines("docs", "full");
		expect(docs.run.has("package")).toBe(false);
	});
});
