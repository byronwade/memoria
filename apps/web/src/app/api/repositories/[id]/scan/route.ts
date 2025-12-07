import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callQuery, callMutation } from "@/lib/convex";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "memoria-internal";

interface ScanStatus {
	_id: string;
	status: "pending" | "running" | "completed" | "failed";
	triggeredBy: "onboarding" | "manual" | "scheduled";
	startedAt: number | null;
	completedAt: number | null;
	errorMessage: string | null;
	totalFiles: number;
	processedFiles: number;
	filesWithRisk: number;
	createdAt: number;
}

interface Repository {
	_id: string;
	fullName: string;
	scmInstallationId: string;
}

interface Installation {
	_id: string;
	providerInstallationId: string;
}

/**
 * GET /api/repositories/[id]/scan
 * Get the current scan status for a repository
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await getSession();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id: repoId } = await params;
		const convex = getConvexClient();

		const scan = await callQuery<ScanStatus | null>(
			convex,
			"scans:getScanStatus",
			{ repositoryId: repoId }
		);

		if (!scan) {
			return NextResponse.json({ status: "none" });
		}

		// Calculate progress percentage
		const progress =
			scan.totalFiles > 0
				? Math.round((scan.processedFiles / scan.totalFiles) * 100)
				: 0;

		return NextResponse.json({
			...scan,
			progress,
		});
	} catch (error) {
		console.error("Failed to get scan status:", error);
		return NextResponse.json(
			{ error: "Failed to get scan status" },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/repositories/[id]/scan
 * Trigger a new scan for a repository
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await getSession();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id: repoId } = await params;
		const convex = getConvexClient();

		// Get repository details
		const repo = await callQuery<Repository | null>(
			convex,
			"scm:getRepository",
			{ repoId }
		);

		if (!repo) {
			return NextResponse.json(
				{ error: "Repository not found" },
				{ status: 404 }
			);
		}

		// Get installation details
		const installation = await callQuery<Installation | null>(
			convex,
			"scm:getInstallationById",
			{ installationId: repo.scmInstallationId }
		);

		if (!installation) {
			return NextResponse.json(
				{ error: "Installation not found" },
				{ status: 404 }
			);
		}

		// Create scan record
		const { scanId, alreadyRunning } = await callMutation<{
			scanId: string;
			alreadyRunning: boolean;
		}>(convex, "scans:createScan", {
			repositoryId: repoId,
			triggeredBy: "manual",
		});

		if (alreadyRunning) {
			return NextResponse.json({
				message: "Scan already running",
				scanId,
				status: "already_running",
			});
		}

		// Trigger background scan (fire and forget)
		fetch(`${APP_URL}/api/scans/execute`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Internal-Key": INTERNAL_API_KEY,
			},
			body: JSON.stringify({
				scanId,
				repositoryId: repoId,
				installationId: installation.providerInstallationId,
				fullName: repo.fullName,
			}),
		}).catch((error) => {
			console.error(`Failed to trigger scan for ${repo.fullName}:`, error);
		});

		return NextResponse.json({
			message: "Scan triggered",
			scanId,
			status: "triggered",
		});
	} catch (error) {
		console.error("Failed to trigger scan:", error);
		return NextResponse.json(
			{ error: "Failed to trigger scan" },
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/repositories/[id]/scan
 * Reset stuck scans for a repository
 */
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await getSession();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id: repoId } = await params;
		const convex = getConvexClient();

		const result = await callMutation<{ resetCount: number }>(
			convex,
			"scans:resetStuckScans",
			{ repositoryId: repoId }
		);

		return NextResponse.json({
			message: `Reset ${result.resetCount} stuck scan(s)`,
			...result,
		});
	} catch (error) {
		console.error("Failed to reset scans:", error);
		return NextResponse.json(
			{ error: "Failed to reset scans" },
			{ status: 500 }
		);
	}
}
