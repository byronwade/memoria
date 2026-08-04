#!/usr/bin/env node
/**
 * CI smoke benchmark — fails if fast analyze regresses badly.
 * Usage (from monorepo root after build):
 *   node apps/mcp-server/scripts/ci-benchmark.mjs
 */

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const distIndex = pathToFileURL(join(pkgRoot, "dist", "index.js")).href;

const FAST_BUDGET_MS = Number(process.env.MEMORIA_BENCH_FAST_MS || 2500);
const FULL_BUDGET_MS = Number(process.env.MEMORIA_BENCH_FULL_MS || 15000);

async function time(fn) {
	const start = performance.now();
	await fn();
	return performance.now() - start;
}

async function main() {
	const memoria = await import(distIndex);
	const { analyzeFile, cache } = memoria;
	const target = join(pkgRoot, "src", "cli.ts");

	cache.clear();
	const fastCold = await time(() =>
		analyzeFile(target, null, { mode: "fast", autoEscalate: false }),
	);
	const fastWarm = await time(() =>
		analyzeFile(target, null, { mode: "fast", autoEscalate: false }),
	);

	cache.clear();
	const fullCold = await time(() =>
		analyzeFile(target, null, { mode: "full", autoEscalate: false, budgetMs: 8000 }),
	);

	const results = {
		fastColdMs: Math.round(fastCold),
		fastWarmMs: Math.round(fastWarm),
		fullColdMs: Math.round(fullCold),
		budgets: { FAST_BUDGET_MS, FULL_BUDGET_MS },
	};

	console.log(JSON.stringify(results, null, 2));

	const failures = [];
	if (fastCold > FAST_BUDGET_MS) {
		failures.push(`fast cold ${Math.round(fastCold)}ms > ${FAST_BUDGET_MS}ms`);
	}
	if (fullCold > FULL_BUDGET_MS) {
		failures.push(`full cold ${Math.round(fullCold)}ms > ${FULL_BUDGET_MS}ms`);
	}
	if (fastWarm > fastCold) {
		// warm should not be slower than cold by a huge margin; soft check only
		console.warn(
			`warn: warm (${Math.round(fastWarm)}ms) slower than cold (${Math.round(fastCold)}ms)`,
		);
	}

	if (failures.length) {
		console.error("Benchmark regressions:\n" + failures.map((f) => ` - ${f}`).join("\n"));
		process.exit(1);
	}

	console.log("Benchmark OK");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
