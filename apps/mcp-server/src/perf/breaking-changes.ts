/**
 * Detect likely breaking API changes by comparing export sets.
 */

const EXPORT_PATTERNS = [
	/export\s+(?:async\s+)?function\s+([A-Za-z_][\w]*)/g,
	/export\s+(?:const|let|var|class|type|interface|enum)\s+([A-Za-z_][\w]*)/g,
	/export\s+\{\s*([^}]+)\}/g,
];

export function extractExportNames(sourceCode: string): string[] {
	const names = new Set<string>();
	for (const re of EXPORT_PATTERNS) {
		re.lastIndex = 0;
		let match: RegExpExecArray | null;
		while ((match = re.exec(sourceCode)) !== null) {
			if (re.source.includes("\\{")) {
				for (const part of match[1].split(",")) {
					const name = part
						.trim()
						.split(/\s+as\s+/)
						.pop()
						?.trim();
					if (name && /^[A-Za-z_][\w]*$/.test(name)) names.add(name);
				}
			} else if (match[1]) {
				names.add(match[1]);
			}
		}
	}
	return [...names].sort();
}

export interface BreakingChangeReport {
	removedExports: string[];
	addedExports: string[];
	summary: string[];
}

/** Alias used by formatters / MCP structured output. */
export type BreakingChange = BreakingChangeReport;

/**
 * Compare current file exports to a previous version's source.
 */
export function detectBreakingChanges(
	currentSource: string,
	previousSource: string | null | undefined,
): BreakingChangeReport {
	if (!previousSource) {
		return { removedExports: [], addedExports: [], summary: [] };
	}
	const current = new Set(extractExportNames(currentSource));
	const previous = new Set(extractExportNames(previousSource));
	const removedExports = [...previous].filter((n) => !current.has(n));
	const addedExports = [...current].filter((n) => !previous.has(n));
	const summary: string[] = [];
	if (removedExports.length > 0) {
		summary.push(
			`Removed exports (breaking): ${removedExports.slice(0, 8).join(", ")}${removedExports.length > 8 ? "…" : ""}`,
		);
	}
	if (addedExports.length > 0) {
		summary.push(
			`Added exports: ${addedExports.slice(0, 8).join(", ")}${addedExports.length > 8 ? "…" : ""}`,
		);
	}
	return { removedExports, addedExports, summary };
}

/**
 * Also flag removals found in a structured diff summary.
 */
export function breakingHintsFromDiff(evidence: {
	removals?: string[];
	hasBreakingChange?: boolean;
} | null | undefined): string[] {
	if (!evidence) return [];
	const hints: string[] = [];
	if (evidence.hasBreakingChange) {
		hints.push("Diff marked as potentially breaking (removed exports/signatures).");
	}
	const removedFns = (evidence.removals ?? []).filter((line) =>
		/\b(export\s+)?(function|class|type|interface|const)\b/.test(line),
	);
	if (removedFns.length > 0) {
		hints.push(
			`Diff removals look API-related (${removedFns.length}): ${removedFns[0].slice(0, 80)}`,
		);
	}
	return hints;
}
