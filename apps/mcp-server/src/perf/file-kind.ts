import path from "node:path";
import type { AnalyzeMode, EngineName, EnginePlan, FileKind } from "./types.js";

const API_INDICATORS =
	/\b(?:app|router|server)\.(get|post|put|delete|patch)\s*\(|@(Get|Post|Put|Delete|Patch)\s*\(|export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\b/i;

const SCHEMA_INDICATORS =
	/(?:CREATE|ALTER|DROP)\s+TABLE\s+\w|@(?:Entity|Table|Column)\b|\bmodel\s+[A-Za-z_]\w*\s*\{|\bmongoose\.Schema\b|\bsequelize\.define\b/i;

/**
 * Cheap file-kind classifier used to skip irrelevant engines.
 */
export function classifyFileKind(
	filePath: string,
	sourceContent = "",
): FileKind {
	const base = path.basename(filePath);
	const ext = path.extname(filePath).toLowerCase();
	const normalized = filePath.replace(/\\/g, "/");
	// Ignore comments / strings / regex literals so scanner source doesn't
	// classify itself as api/schema.
	const code = sourceContent
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:\\\w])\/\/.*$/gm, "$1")
		.replace(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g, '""')
		.replace(/\/(?:\\\/|[^/\n])+\/[gimsuy]*/g, " ");

	if (/\.(test|spec)\./i.test(base) || /\/__tests__\//i.test(normalized)) {
		return "test";
	}
	if (
		[".md", ".mdx", ".mdc", ".rst", ".txt"].includes(ext) ||
		/\/docs\//i.test(normalized)
	) {
		return "docs";
	}
	if (
		[".json", ".yml", ".yaml", ".toml", ".env", ".ini"].includes(ext) ||
		/\.config\./i.test(base) ||
		base.startsWith(".")
	) {
		return "config";
	}
	if (
		/\/(routes?|api|controllers?|handlers?)\//i.test(normalized) ||
		API_INDICATORS.test(code)
	) {
		return "api";
	}
	if (
		/\/(schema|models?|migrations?|prisma)\//i.test(normalized) ||
		[".prisma", ".sql"].includes(ext) ||
		SCHEMA_INDICATORS.test(code)
	) {
		return "schema";
	}
	if (
		[
			".ts",
			".tsx",
			".js",
			".jsx",
			".mjs",
			".cjs",
			".py",
			".go",
			".rs",
			".java",
			".rb",
		].includes(ext)
	) {
		return "source";
	}
	return "unknown";
}

/** Default engines for analyze mode before kind-based pruning. */
function baseEngines(mode: AnalyzeMode): Set<EngineName> {
	if (mode === "fast") {
		return new Set<EngineName>([
			"volatility",
			"git",
			"importers",
			"test",
		]);
	}
	return new Set<EngineName>([
		"volatility",
		"git",
		"importers",
		"docs",
		"type",
		"content",
		"test",
		"env",
		"schema",
		"api",
		"transitive",
		"symbol",
		"package",
	]);
}

/**
 * Build the engine run plan from mode + file kind.
 */
export function planEngines(
	kind: FileKind,
	mode: AnalyzeMode,
	opts?: {
		includeTransitive?: boolean;
		skipEvidence?: boolean;
		hasSymbol?: boolean;
	},
): EnginePlan {
	const run = baseEngines(mode);

	// Kind-based pruning
	if (kind === "docs" || kind === "config") {
		run.delete("api");
		run.delete("schema");
		run.delete("env");
		run.delete("type");
		run.delete("content");
		run.delete("transitive");
		run.delete("symbol");
		run.delete("package");
	}
	if (kind === "test") {
		run.delete("docs");
		run.delete("api");
		run.delete("schema");
		run.delete("transitive");
		run.delete("package");
	}
	if (kind === "api") {
		run.delete("schema");
	}
	if (kind === "schema") {
		run.delete("api");
	}
	if (kind === "source") {
		// Pure source rarely defines HTTP routes or SQL schemas
		if (mode === "fast") {
			run.delete("api");
			run.delete("schema");
		}
	}

	let deferTransitive = mode === "fast" || kind === "test" || kind === "docs";
	if (opts?.includeTransitive === true) {
		run.add("transitive");
		deferTransitive = false;
	} else if (opts?.includeTransitive === false) {
		run.delete("transitive");
		deferTransitive = true;
	}

	if (opts?.hasSymbol) {
		run.add("symbol");
	} else if (mode === "fast") {
		run.delete("symbol");
	}

	return {
		kind,
		mode,
		run,
		deferTransitive,
		skipEvidence: opts?.skipEvidence ?? mode === "fast",
	};
}

/** Confidence defaults by coupling source. */
export function sourceConfidence(
	source: string,
): number {
	switch (source) {
		case "git":
			return 0.9;
		case "test":
			return 0.85;
		case "api":
			return 0.8;
		case "symbol":
			return 0.8;
		case "package":
			return 0.75;
		case "type":
			return 0.7;
		case "docs":
			return 0.55;
		case "env":
			return 0.5;
		case "schema":
			return 0.5;
		case "content":
			return 0.45;
		case "transitive":
			return 0.6;
		default:
			return 0.5;
	}
}
