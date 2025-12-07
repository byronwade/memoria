import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getConvexClient, callQuery } from "@/lib/convex";

interface RepositoryStats {
	totalAnalyses: number;
	issuesPrevented: number;
	avgRiskScore: number;
	healthScore: number;
	trend: "up" | "down" | "stable";
	riskDistribution: {
		high: number;
		medium: number;
		low: number;
	};
	analysisBreakdown: {
		prAnalyses: number;
		fileAnalyses: number;
		couplingDetections: number;
	};
}

interface RiskyFile {
	_id: string;
	filePath: string;
	riskScore: number;
	riskLevel: "high" | "medium" | "low";
	volatilityScore: number;
	coupledFilesCount: number;
	importersCount: number;
	lastAnalyzedAt: number;
}

// Scan-based types
interface ScanSummary {
	totalScans: number;
	lastScan: {
		_id: string;
		status: string;
		completedAt: number | null;
		totalFiles: number;
		filesWithRisk: number;
	} | null;
	totalFilesAnalyzed: number;
	filesWithRisk: number;
	averageRiskScore: number;
}

interface ScanRiskyFile {
	filePath: string;
	riskScore: number;
	riskLevel: "low" | "medium" | "high" | "critical";
	volatilityScore: number;
	couplingScore: number;
	importerCount: number;
	lastAnalyzedAt: number;
}

interface FileAnalysis {
	_id: string;
	filePath: string;
	riskScore: number;
	riskLevel: "low" | "medium" | "high" | "critical";
	volatilityScore: number;
	couplingScore: number;
	importerCount: number;
	coupledFiles: Array<{ file: string; score: number; changeType: string }>;
	lastAnalyzedAt: number;
}

interface Activity {
	_id: string;
	type: "analysis" | "pr" | "coupling" | "drift";
	description: string;
	filePath?: string;
	riskLevel?: "high" | "medium" | "low";
	timestamp: number;
}

interface CouplingPair {
	file1: string;
	file2: string;
	couplingScore: number;
	coChangeCount: number;
	relationship: string;
}

interface ChartDataPoint {
	date: string;
	analyses: number;
	prevented: number;
	avgRisk: number;
}

interface Contributor {
	name: string;
	avatar?: string;
	commits: number;
	filesOwned: number;
}

/**
 * GET /api/repositories/[id]/stats
 * Get comprehensive statistics for a repository
 */
export async function GET(
	request: NextRequest,
	context: { params: Promise<{ id: string }> }
) {
	try {
		const cookieStore = await cookies();
		const sessionToken = cookieStore.get("session_token")?.value;

		if (!sessionToken) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const convex = getConvexClient();

		// Validate session
		const session = await callQuery<{
			user: { _id: string };
		} | null>(convex, "auth:getSession", { sessionToken });

		if (!session?.user) {
			return NextResponse.json({ error: "Invalid session" }, { status: 401 });
		}

		const { id: repoId } = await context.params;
		const { searchParams } = new URL(request.url);

		// Parse query parameters
		const dataType = searchParams.get("type") || "all";
		const limit = parseInt(searchParams.get("limit") || "10");
		const offset = parseInt(searchParams.get("offset") || "0");

		// Fetch data based on type
		if (dataType === "stats" || dataType === "all") {
			// Fetch scan-based data (from file_analyses table)
			const [scanSummary, scanRiskyFiles, allFileAnalyses] = await Promise.all([
				callQuery<ScanSummary>(
					convex,
					"scans:getScanSummary",
					{ repositoryId: repoId }
				),
				callQuery<ScanRiskyFile[]>(
					convex,
					"scans:getRiskyFiles",
					{ repositoryId: repoId, limit: 100 }
				),
				callQuery<FileAnalysis[]>(
					convex,
					"scans:getFileAnalyses",
					{ repositoryId: repoId, limit: 1000 }
				),
			]);

			// Calculate risk distribution from file analyses
			const highRiskFiles = allFileAnalyses.filter(f => f.riskScore >= 50).length;
			const mediumRiskFiles = allFileAnalyses.filter(f => f.riskScore >= 25 && f.riskScore < 50).length;
			const lowRiskFiles = allFileAnalyses.filter(f => f.riskScore < 25).length;

			// Calculate health score (inverse of risk)
			const avgRisk = scanSummary.averageRiskScore;
			const healthScore = Math.max(0, Math.min(100, 100 - avgRisk));

			// Build stats from scan data
			const stats: RepositoryStats = {
				totalAnalyses: scanSummary.totalFilesAnalyzed,
				issuesPrevented: 0, // This would come from PR analyses
				avgRiskScore: scanSummary.averageRiskScore,
				healthScore,
				trend: "stable" as const,
				riskDistribution: {
					high: highRiskFiles,
					medium: mediumRiskFiles,
					low: lowRiskFiles,
				},
				analysisBreakdown: {
					prAnalyses: 0,
					fileAnalyses: scanSummary.totalFilesAnalyzed,
					couplingDetections: allFileAnalyses.filter(f => f.coupledFiles.length > 0).length,
				},
			};

			if (dataType === "stats") {
				return NextResponse.json({ stats });
			}

			// Build risky files from scan data
			const riskyFilesFormatted = scanRiskyFiles.slice(offset, offset + limit).map(f => ({
				_id: f.filePath, // Use filePath as ID since we don't have the actual ID
				filePath: f.filePath,
				riskScore: f.riskScore,
				riskLevel: f.riskLevel === "critical" ? "high" : f.riskLevel as "high" | "medium" | "low",
				volatilityScore: f.volatilityScore,
				coupledFilesCount: f.couplingScore, // Approximation
				importersCount: f.importerCount,
				lastAnalyzedAt: f.lastAnalyzedAt,
			}));

			// Build coupling pairs from file analyses
			const couplingPairs: CouplingPair[] = [];
			for (const file of allFileAnalyses.slice(0, 50)) {
				for (const coupled of file.coupledFiles.slice(0, 3)) {
					couplingPairs.push({
						file1: file.filePath,
						file2: coupled.file,
						couplingScore: coupled.score,
						coChangeCount: Math.round(coupled.score / 10), // Approximation
						relationship: coupled.changeType || "co-change",
					});
				}
			}

			// For "all", return everything
			return NextResponse.json({
				stats,
				riskyFiles: {
					files: riskyFilesFormatted,
					total: scanRiskyFiles.length,
				},
				activity: { activities: [], total: 0 }, // No activity data from scans yet
				coupling: {
					pairs: couplingPairs.slice(offset, offset + limit),
					total: couplingPairs.length,
				},
				chartData: [], // Would need to aggregate by date
				contributors: [], // Would need to extract from git history
			});
		}

		if (dataType === "riskyFiles") {
			const scanRiskyFiles = await callQuery<ScanRiskyFile[]>(
				convex,
				"scans:getRiskyFiles",
				{ repositoryId: repoId, limit: 100 }
			);
			const riskyFilesFormatted = scanRiskyFiles.slice(offset, offset + limit).map(f => ({
				_id: f.filePath,
				filePath: f.filePath,
				riskScore: f.riskScore,
				riskLevel: f.riskLevel === "critical" ? "high" : f.riskLevel as "high" | "medium" | "low",
				volatilityScore: f.volatilityScore,
				coupledFilesCount: f.couplingScore,
				importersCount: f.importerCount,
				lastAnalyzedAt: f.lastAnalyzedAt,
			}));
			return NextResponse.json({ riskyFiles: { files: riskyFilesFormatted, total: scanRiskyFiles.length } });
		}

		if (dataType === "activity") {
			// Activity would come from PR analyses - return empty for now
			return NextResponse.json({ activity: { activities: [], total: 0 } });
		}

		if (dataType === "coupling") {
			const allFileAnalyses = await callQuery<FileAnalysis[]>(
				convex,
				"scans:getFileAnalyses",
				{ repositoryId: repoId, limit: 1000 }
			);
			const couplingPairs: CouplingPair[] = [];
			for (const file of allFileAnalyses) {
				for (const coupled of file.coupledFiles.slice(0, 3)) {
					couplingPairs.push({
						file1: file.filePath,
						file2: coupled.file,
						couplingScore: coupled.score,
						coChangeCount: Math.round(coupled.score / 10),
						relationship: coupled.changeType || "co-change",
					});
				}
			}
			return NextResponse.json({
				coupling: {
					pairs: couplingPairs.slice(offset, offset + limit),
					total: couplingPairs.length,
				}
			});
		}

		if (dataType === "chart") {
			// Chart data would need aggregation by date - return empty for now
			return NextResponse.json({ chartData: [] });
		}

		if (dataType === "contributors") {
			// Contributors would need git history extraction - return empty for now
			return NextResponse.json({ contributors: [] });
		}

		return NextResponse.json({ error: "Invalid data type" }, { status: 400 });
	} catch (error) {
		console.error("Failed to fetch repository stats:", error);
		return NextResponse.json(
			{ error: "Failed to fetch repository stats" },
			{ status: 500 }
		);
	}
}
