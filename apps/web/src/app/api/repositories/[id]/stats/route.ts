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
			const stats = await callQuery<RepositoryStats | null>(
				convex,
				"scm:getRepositoryStats",
				{ repoId }
			);

			if (dataType === "stats") {
				return NextResponse.json({ stats });
			}

			// For "all", fetch everything
			const [riskyFiles, activity, coupling, chartData, contributors] = await Promise.all([
				callQuery<{ files: RiskyFile[]; total: number }>(
					convex,
					"scm:getRepositoryRiskyFiles",
					{ repoId, limit, offset }
				),
				callQuery<{ activities: Activity[]; total: number }>(
					convex,
					"scm:getRepositoryActivity",
					{ repoId, limit, offset }
				),
				callQuery<{ pairs: CouplingPair[]; total: number }>(
					convex,
					"scm:getRepositoryCoupling",
					{ repoId, limit, offset }
				),
				callQuery<ChartDataPoint[]>(
					convex,
					"scm:getRepositoryChartData",
					{ repoId }
				),
				callQuery<Contributor[]>(
					convex,
					"scm:getRepositoryContributors",
					{ repoId, limit: 10 }
				),
			]);

			return NextResponse.json({
				stats,
				riskyFiles,
				activity,
				coupling,
				chartData,
				contributors,
			});
		}

		if (dataType === "riskyFiles") {
			const riskyFiles = await callQuery<{ files: RiskyFile[]; total: number }>(
				convex,
				"scm:getRepositoryRiskyFiles",
				{ repoId, limit, offset }
			);
			return NextResponse.json({ riskyFiles });
		}

		if (dataType === "activity") {
			const activity = await callQuery<{ activities: Activity[]; total: number }>(
				convex,
				"scm:getRepositoryActivity",
				{ repoId, limit, offset }
			);
			return NextResponse.json({ activity });
		}

		if (dataType === "coupling") {
			const coupling = await callQuery<{ pairs: CouplingPair[]; total: number }>(
				convex,
				"scm:getRepositoryCoupling",
				{ repoId, limit, offset }
			);
			return NextResponse.json({ coupling });
		}

		if (dataType === "chart") {
			const chartData = await callQuery<ChartDataPoint[]>(
				convex,
				"scm:getRepositoryChartData",
				{ repoId }
			);
			return NextResponse.json({ chartData });
		}

		if (dataType === "contributors") {
			const contributors = await callQuery<Contributor[]>(
				convex,
				"scm:getRepositoryContributors",
				{ repoId, limit }
			);
			return NextResponse.json({ contributors });
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
