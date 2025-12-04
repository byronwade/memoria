/**
 * Memoria Performance Benchmarks
 *
 * Measures real-world performance of all engines and calculates token usage.
 * Run with: npx tsx benchmarks/run-benchmarks.ts
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");

interface BenchmarkResult {
	name: string;
	runs: number;
	avgMs: number;
	minMs: number;
	maxMs: number;
	medianMs: number;
	p95Ms: number;
	outputChars: number;
	estimatedTokens: number;
}

interface BenchmarkSuite {
	timestamp: string;
	nodeVersion: string;
	platform: string;
	results: BenchmarkResult[];
	summary: {
		totalAnalysisTimeMs: number;
		estimatedTokensPerAnalysis: number;
		cacheHitSpeedupFactor: number;
	};
}

// Estimate tokens (rough: 1 token ≈ 4 chars for English text)
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

// Calculate percentile
function percentile(arr: number[], p: number): number {
	const sorted = [...arr].sort((a, b) => a - b);
	const idx = Math.ceil((p / 100) * sorted.length) - 1;
	return sorted[Math.max(0, idx)];
}

// Run a benchmark multiple times
async function benchmark(
	name: string,
	fn: () => Promise<string | object | null>,
	runs = 10,
): Promise<BenchmarkResult> {
	const times: number[] = [];
	let lastOutput = "";

	// Warm-up run (not counted)
	try {
		await fn();
	} catch {
		// Ignore warm-up errors
	}

	for (let i = 0; i < runs; i++) {
		const start = performance.now();
		try {
			const result = await fn();
			lastOutput =
				typeof result === "string" ? result : JSON.stringify(result, null, 2);
		} catch {
			lastOutput = "";
		}
		const end = performance.now();
		times.push(end - start);
	}

	const avg = times.reduce((a, b) => a + b, 0) / times.length;
	const sorted = [...times].sort((a, b) => a - b);

	return {
		name,
		runs,
		avgMs: Math.round(avg * 100) / 100,
		minMs: Math.round(sorted[0] * 100) / 100,
		maxMs: Math.round(sorted[sorted.length - 1] * 100) / 100,
		medianMs: Math.round(percentile(times, 50) * 100) / 100,
		p95Ms: Math.round(percentile(times, 95) * 100) / 100,
		outputChars: lastOutput.length,
		estimatedTokens: estimateTokens(lastOutput),
	};
}

async function runBenchmarks(): Promise<BenchmarkSuite> {
	console.log("🔬 Memoria Performance Benchmarks\n");
	console.log("Loading modules...");

	// Dynamic import to get fresh module
	const memoria = await import("../dist/index.js");
	const {
		getCoupledFiles,
		getVolatility,
		checkDrift,
		getImporters,
		searchHistory,
		getSiblingGuidance,
		createAnalysisContext,
		generateAiInstructions,
		cache,
	} = memoria;

	const testFile = join(projectRoot, "src", "index.ts");
	const results: BenchmarkResult[] = [];

	console.log(`Test file: ${testFile}\n`);
	console.log("Running benchmarks (10 iterations each)...\n");

	// Clear cache before each benchmark group
	cache.clear();

	// 1. Create Analysis Context
	console.log("  [1/8] createAnalysisContext...");
	results.push(
		await benchmark("createAnalysisContext", () =>
			createAnalysisContext(testFile),
		),
	);

	// Create a shared context for subsequent tests
	cache.clear();
	const ctx = await createAnalysisContext(testFile);

	// 2. Coupling Engine (cold)
	console.log("  [2/8] getCoupledFiles (cold cache)...");
	cache.clear();
	results.push(
		await benchmark(
			"getCoupledFiles (cold)",
			async () => {
				cache.clear();
				return getCoupledFiles(testFile, ctx);
			},
			5,
		),
	);

	// 3. Coupling Engine (warm cache)
	console.log("  [3/8] getCoupledFiles (warm cache)...");
	await getCoupledFiles(testFile, ctx); // Prime cache
	results.push(
		await benchmark(
			"getCoupledFiles (cached)",
			() => getCoupledFiles(testFile, ctx),
			10,
		),
	);

	// 4. Volatility Engine
	console.log("  [4/8] getVolatility...");
	cache.clear();
	results.push(
		await benchmark(
			"getVolatility (cold)",
			async () => {
				cache.clear();
				return getVolatility(testFile, ctx);
			},
			5,
		),
	);

	// 5. Drift Engine
	console.log("  [5/8] checkDrift...");
	const coupledFiles = await getCoupledFiles(testFile, ctx);
	cache.clear();
	results.push(
		await benchmark("checkDrift", () =>
			checkDrift(testFile, coupledFiles, ctx),
		),
	);

	// 6. Import Detection
	console.log("  [6/8] getImporters...");
	cache.clear();
	results.push(
		await benchmark(
			"getImporters (cold)",
			async () => {
				cache.clear();
				return getImporters(testFile, ctx);
			},
			5,
		),
	);

	// 7. History Search
	console.log("  [7/8] searchHistory...");
	cache.clear();
	results.push(
		await benchmark(
			"searchHistory",
			() => searchHistory("fix", testFile, "both", 10),
			5,
		),
	);

	// 8. Sibling Guidance
	console.log("  [8/8] getSiblingGuidance...");
	cache.clear();
	results.push(
		await benchmark(
			"getSiblingGuidance",
			async () => {
				cache.clear();
				return getSiblingGuidance(testFile);
			},
			5,
		),
	);

	// 9. Full Analysis Pipeline (formatOutput)
	console.log("  [9/9] Full analysis pipeline...");
	cache.clear();

	// First, get the actual output to measure tokens
	const freshCtx = await createAnalysisContext(testFile);
	const [coupledForOutput, volatilityForOutput] = await Promise.all([
		getCoupledFiles(testFile, freshCtx),
		getVolatility(testFile, freshCtx),
	]);
	const [driftForOutput, importersForOutput] = await Promise.all([
		checkDrift(testFile, coupledForOutput, freshCtx),
		getImporters(testFile, freshCtx),
	]);
	const fullOutput = generateAiInstructions(
		testFile,
		volatilityForOutput,
		coupledForOutput,
		driftForOutput,
		importersForOutput,
	);
	const fullOutputTokens = estimateTokens(fullOutput);

	cache.clear();
	const fullAnalysisBench = await benchmark(
		"Full Analysis (formatOutput)",
		async () => {
			cache.clear();
			const ctx2 = await createAnalysisContext(testFile);
			const [c, v] = await Promise.all([
				getCoupledFiles(testFile, ctx2),
				getVolatility(testFile, ctx2),
			]);
			const [d, i] = await Promise.all([
				checkDrift(testFile, c, ctx2),
				getImporters(testFile, ctx2),
			]);
			return generateAiInstructions(testFile, v, c, d, i);
		},
		5,
	);
	// Override the token count with the actual measurement
	fullAnalysisBench.outputChars = fullOutput.length;
	fullAnalysisBench.estimatedTokens = fullOutputTokens;
	results.push(fullAnalysisBench);

	// Calculate cache speedup
	const coldCoupling = results.find((r) => r.name === "getCoupledFiles (cold)");
	const warmCoupling = results.find(
		(r) => r.name === "getCoupledFiles (cached)",
	);
	const cacheSpeedup =
		coldCoupling && warmCoupling
			? Math.round((coldCoupling.avgMs / warmCoupling.avgMs) * 10) / 10
			: 1;

	// Full analysis result for token estimate
	const fullAnalysis = results.find(
		(r) => r.name === "Full Analysis (formatOutput)",
	);

	const suite: BenchmarkSuite = {
		timestamp: new Date().toISOString(),
		nodeVersion: process.version,
		platform: `${process.platform} ${process.arch}`,
		results,
		summary: {
			totalAnalysisTimeMs: fullAnalysis?.avgMs || 0,
			estimatedTokensPerAnalysis: fullAnalysis?.estimatedTokens || 0,
			cacheHitSpeedupFactor: cacheSpeedup,
		},
	};

	return suite;
}

function formatResults(suite: BenchmarkSuite): string {
	const lines: string[] = [];

	lines.push("# Memoria Benchmark Results\n");
	lines.push(`**Date:** ${suite.timestamp}`);
	lines.push(`**Node:** ${suite.nodeVersion}`);
	lines.push(`**Platform:** ${suite.platform}\n`);

	lines.push("## Individual Engine Performance\n");
	lines.push("| Engine | Avg (ms) | Median (ms) | P95 (ms) | Output Tokens |");
	lines.push("|--------|----------|-------------|----------|---------------|");

	for (const r of suite.results) {
		lines.push(
			`| ${r.name} | ${r.avgMs} | ${r.medianMs} | ${r.p95Ms} | ~${r.estimatedTokens} |`,
		);
	}

	lines.push("\n## Summary\n");
	lines.push(
		`- **Full analysis time:** ${suite.summary.totalAnalysisTimeMs}ms average`,
	);
	lines.push(
		`- **Tokens per analysis:** ~${suite.summary.estimatedTokensPerAnalysis} tokens`,
	);
	lines.push(
		`- **Cache speedup:** ${suite.summary.cacheHitSpeedupFactor}x faster on cache hit`,
	);

	lines.push("\n## README Badge Data\n");
	lines.push("```");
	lines.push(
		`Analysis Speed: <${Math.ceil(suite.summary.totalAnalysisTimeMs / 100) * 100}ms`,
	);
	lines.push(
		`Token Usage: ~${Math.ceil(suite.summary.estimatedTokensPerAnalysis / 100) * 100} tokens/analysis`,
	);
	lines.push(`Cache Speedup: ${suite.summary.cacheHitSpeedupFactor}x`);
	lines.push("```");

	return lines.join("\n");
}

// Run benchmarks
console.log("═".repeat(50));
runBenchmarks()
	.then((suite) => {
		console.log("\n" + "═".repeat(50));
		console.log("\n✅ Benchmarks complete!\n");

		const formatted = formatResults(suite);
		console.log(formatted);

		// Save results to file
		const resultsPath = join(projectRoot, "benchmarks", "RESULTS.md");
		writeFileSync(
			resultsPath,
			formatted +
				"\n\n## Raw JSON\n\n```json\n" +
				JSON.stringify(suite, null, 2) +
				"\n```\n",
		);
		console.log(`\n📄 Results saved to: ${resultsPath}`);

		// Also output raw JSON for programmatic use
		console.log("\n## Raw JSON\n");
		console.log("```json");
		console.log(JSON.stringify(suite, null, 2));
		console.log("```");
	})
	.catch((err) => {
		console.error("Benchmark failed:", err);
		process.exit(1);
	});
