import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

describe("Budgeted / fast analyze", () => {
	let analyzeFile: typeof import("../src/index.js").analyzeFile;
	let classifyFileKind: typeof import("../src/index.js").classifyFileKind;
	let planEngines: typeof import("../src/index.js").planEngines;
	let sourceConfidence: typeof import("../src/index.js").sourceConfidence;
	let extractSymbols: typeof import("../src/index.js").extractSymbols;
	let cache: { clear: () => void };

	beforeEach(async () => {
		const mod = await import("../src/index.js");
		analyzeFile = mod.analyzeFile;
		classifyFileKind = mod.classifyFileKind;
		planEngines = mod.planEngines;
		sourceConfidence = mod.sourceConfidence;
		extractSymbols = mod.extractSymbols;
		cache = mod.cache;
		cache.clear();
	});

	it("classifies API and test files", () => {
		expect(classifyFileKind("src/foo.test.ts")).toBe("test");
		expect(
			classifyFileKind(
				"src/routes/users.ts",
				`app.get("/users", handler)`,
			),
		).toBe("api");
		expect(classifyFileKind("README.md")).toBe("docs");
	});

	it("plans fewer engines for fast mode", () => {
		const fast = planEngines("source", "fast");
		expect(fast.run.has("volatility")).toBe(true);
		expect(fast.run.has("importers")).toBe(true);
		expect(fast.run.has("docs")).toBe(false);
		expect(fast.deferTransitive).toBe(true);

		const full = planEngines("source", "full");
		expect(full.run.has("type")).toBe(true);
	});

	it("assigns lower confidence to heuristic sources", () => {
		expect(sourceConfidence("git")).toBeGreaterThan(sourceConfidence("content"));
		expect(sourceConfidence("env")).toBeLessThan(0.7);
	});

	it("extracts symbols from TypeScript exports", () => {
		const symbols = extractSymbols(`
			export function foo() {}
			export const bar = 1;
			export type Baz = string;
		`);
		expect(symbols).toContain("foo");
		expect(symbols).toContain("bar");
		expect(symbols).toContain("Baz");
	});

	it("fast mode runs fewer engines and finishes quickly", async () => {
		const filePath = join(projectRoot, "src", "index.ts");
		const analysis = await analyzeFile(filePath, null, {
			mode: "fast",
			autoEscalate: false,
		});

		expect(analysis.mode).toBe("fast");
		expect(analysis.enginesRun).toBeDefined();
		expect(analysis.enginesRun!.includes("volatility")).toBe(true);
		expect(analysis.enginesRun!.includes("docs")).toBe(false);
		expect(analysis.elapsedMs).toBeLessThan(3000);
		expect(analysis.risk.score).toBeGreaterThanOrEqual(0);
	}, 30000);

	it("full mode includes confidence on coupled files", async () => {
		const filePath = join(projectRoot, "src", "cli.ts");
		const analysis = await analyzeFile(filePath, null, { mode: "full" });

		expect(analysis.mode).toBe("full");
		for (const c of analysis.coupled) {
			expect(typeof c.confidence).toBe("number");
			expect(c.confidence!).toBeGreaterThan(0);
			expect(c.confidence!).toBeLessThanOrEqual(1);
		}
	}, 30000);

	it("respects confidenceMin filter", async () => {
		const filePath = join(projectRoot, "src", "index.ts");
		const loose = await analyzeFile(filePath, null, {
			mode: "full",
			confidenceMin: 0,
		});
		cache.clear();
		const strict = await analyzeFile(filePath, null, {
			mode: "full",
			confidenceMin: 0.8,
		});

		expect(strict.coupled.length).toBeLessThanOrEqual(loose.coupled.length);
		for (const c of strict.coupled) {
			expect(c.confidence ?? 0).toBeGreaterThanOrEqual(0.8);
		}
	}, 30000);

	it("emits progress events when onProgress is provided", async () => {
		const filePath = join(projectRoot, "src", "auth.ts");
		const events: string[] = [];
		await analyzeFile(filePath, null, {
			mode: "fast",
			autoEscalate: false,
			onProgress: (e) => events.push(e.phase),
		});
		expect(events).toContain("start");
		expect(events).toContain("done");
	}, 30000);

	it("escalates fast to full when risk is high", async () => {
		const filePath = join(projectRoot, "src", "index.ts");
		const analysis = await analyzeFile(filePath, null, {
			mode: "fast",
			autoEscalate: true,
		});
		// Hot core file typically escalates; if not, mode stays fast with low risk.
		if (analysis.escalated) {
			expect(analysis.mode).toBe("full");
			expect(analysis.structured?.escalated).toBe(true);
		} else {
			expect(analysis.mode).toBe("fast");
			expect(analysis.risk.score).toBeLessThan(50);
		}
	}, 30000);
});

describe("Language packs", () => {
	it("builds python and go import patterns", async () => {
		const { importGrepPatterns, detectLanguage } = await import(
			"../src/perf/language-packs.js"
		);
		expect(detectLanguage("pkg/foo.go")).toBe("go");
		expect(detectLanguage("mod.py")).toBe("python");
		const py = importGrepPatterns({
			fileName: "utils",
			parentDir: "helpers",
			generic: false,
			language: "python",
		});
		expect(py.some((p) => p.includes("from") || p.includes("import"))).toBe(
			true,
		);
	});
});
