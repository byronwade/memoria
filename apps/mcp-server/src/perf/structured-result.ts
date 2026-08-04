/**
 * Machine-readable analysis payload for MCP / scripting clients.
 */

export interface StructuredAnalysisInput {
	filePath: string;
	risk: {
		score: number;
		level: string;
		factors: string[];
		action: string;
	};
	volatility: {
		commitCount: number;
		panicScore: number;
		topAuthor?: { name: string; percentage: number } | null;
	};
	coupled: Array<{
		file: string;
		score: number;
		source: string;
		reason: string;
		confidence?: number;
	}>;
	importers: string[];
	drift: Array<{ file: string; daysOld: number }>;
	mode?: string;
	kind?: string;
	enginesRun?: string[];
	elapsedMs?: number;
}

/** @deprecated Alias — prefer StructuredAnalysis */
export type StructuredAnalysisResult = StructuredAnalysis;

export interface StructuredAnalysis {
	file: string;
	absolutePath: string;
	risk: {
		score: number;
		level: string;
		factors: string[];
		action: string;
	};
	volatility: {
		commitCount: number;
		panicScore: number;
		topAuthor: string | null;
		topAuthorPct: number | null;
	};
	coupled: Array<{
		file: string;
		score: number;
		source: string;
		reason: string;
		confidence?: number;
	}>;
	importers: string[];
	drift: Array<{ file: string; daysOld: number }>;
	mode?: string;
	kind?: string;
	enginesRun?: string[];
	elapsedMs?: number;
	escalated?: boolean;
	ownerBrief?: string | null;
	breakingChanges?: string[];
}

export function toStructuredAnalysis(
	analysis: StructuredAnalysisInput,
	extras?: {
		escalated?: boolean;
		ownerBrief?: string | null;
		breakingChanges?: string[];
	},
): StructuredAnalysis {
	return {
		file: analysis.filePath.split(/[/\\]/).pop() ?? analysis.filePath,
		absolutePath: analysis.filePath,
		risk: {
			score: analysis.risk.score,
			level: analysis.risk.level,
			factors: analysis.risk.factors,
			action: analysis.risk.action,
		},
		volatility: {
			commitCount: analysis.volatility.commitCount,
			panicScore: analysis.volatility.panicScore,
			topAuthor: analysis.volatility.topAuthor?.name ?? null,
			topAuthorPct: analysis.volatility.topAuthor?.percentage ?? null,
		},
		coupled: analysis.coupled.map((c) => ({
			file: c.file,
			score: c.score,
			source: c.source,
			reason: c.reason,
			confidence: c.confidence,
		})),
		importers: analysis.importers,
		drift: analysis.drift.map((d) => ({ file: d.file, daysOld: d.daysOld })),
		mode: analysis.mode,
		kind: analysis.kind,
		enginesRun: analysis.enginesRun,
		elapsedMs: analysis.elapsedMs,
		escalated: extras?.escalated,
		ownerBrief: extras?.ownerBrief ?? null,
		breakingChanges: extras?.breakingChanges ?? [],
	};
}

/** Should a fast analysis escalate to full? */
export function shouldEscalate(
	analysis: Pick<StructuredAnalysisInput, "mode" | "risk" | "importers">,
	opts?: {
		riskThreshold?: number;
		importerThreshold?: number;
	},
): boolean {
	const riskThreshold = opts?.riskThreshold ?? 50;
	const importerThreshold = opts?.importerThreshold ?? 15;
	if (analysis.mode !== "fast") return false;
	if (analysis.risk.score >= riskThreshold) return true;
	if (analysis.importers.length >= importerThreshold) return true;
	return false;
}
