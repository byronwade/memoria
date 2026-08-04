/**
 * Shared types for budgeted / streaming / diff analysis.
 */

export type AnalyzeMode = "fast" | "full";

export type FileKind =
	| "source"
	| "test"
	| "api"
	| "schema"
	| "config"
	| "docs"
	| "unknown";

/** Engines that participate in analyzeFile fan-out. */
export type EngineName =
	| "volatility"
	| "git"
	| "importers"
	| "docs"
	| "type"
	| "content"
	| "test"
	| "env"
	| "schema"
	| "api"
	| "transitive"
	| "symbol";

export interface AnalyzeOptions {
	/** fast = core engines only; full = all engines (default for CLI). */
	mode?: AnalyzeMode;
	/** Git ref to diff against (e.g. HEAD~1, main). Enables multi-file diff analysis. */
	diffBase?: string;
	/** Optional exported symbol to resolve callers for (symbol-level coupling). */
	symbol?: string;
	/** Soft wall-clock budget in ms; expensive engines may be skipped when exceeded. */
	budgetMs?: number;
	/** Force include/exclude transitive engine (overrides mode defaults). */
	includeTransitive?: boolean;
	/** Drop coupled results below this confidence (0–1). */
	confidenceMin?: number;
	/** Skip git diff evidence parsing (faster entanglement). */
	skipEvidence?: boolean;
	/** Progress callback for streaming MCP / CLI. */
	onProgress?: (event: AnalyzeProgressEvent) => void;
}

export interface AnalyzeProgressEvent {
	phase: "start" | "engine" | "merge" | "done" | "skip";
	engine?: EngineName;
	message: string;
	elapsedMs: number;
}

export interface EnginePlan {
	kind: FileKind;
	mode: AnalyzeMode;
	run: Set<EngineName>;
	deferTransitive: boolean;
	skipEvidence: boolean;
}
