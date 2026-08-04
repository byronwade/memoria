/**
 * CI helper: fail if critical-risk changed files lack test coupling.
 */

export interface CriticalCheckAnalysis {
	filePath: string;
	risk: { score: number };
	coupled: Array<{ source: string }>;
}

export interface CriticalCheckResult {
	ok: boolean;
	failures: Array<{ file: string; risk: number; reason: string }>;
	checked: number;
}

export function evaluateCriticalRiskTests(
	analyses: CriticalCheckAnalysis[],
	opts?: { riskThreshold?: number },
): CriticalCheckResult {
	const riskThreshold = opts?.riskThreshold ?? 75;
	const failures: CriticalCheckResult["failures"] = [];

	for (const a of analyses) {
		if (a.risk.score < riskThreshold) continue;
		const hasTest = a.coupled.some((c) => c.source === "test");
		const looksLikeTest = /\.(test|spec)\./i.test(a.filePath);
		if (looksLikeTest) continue;
		if (!hasTest) {
			failures.push({
				file: a.filePath,
				risk: a.risk.score,
				reason: `Critical risk (${a.risk.score}) without [test] coupling — add/update tests before merge.`,
			});
		}
	}

	return {
		ok: failures.length === 0,
		failures,
		checked: analyses.filter((a) => a.risk.score >= riskThreshold).length,
	};
}
