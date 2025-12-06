import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callMutation, callQuery } from "@/lib/convex";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "memoria-internal";

interface Repository {
	_id: string;
	isActive: boolean;
	fullName: string;
	scmInstallationId: string;
}

interface Installation {
	_id: string;
	providerInstallationId: string;
}

export async function POST(request: NextRequest) {
	try {
		const session = await getSession();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { orgId, repoIds } = body;

		if (!orgId || !Array.isArray(repoIds)) {
			return NextResponse.json(
				{ error: "Missing orgId or repoIds" },
				{ status: 400 }
			);
		}

		const convex = getConvexClient();

		// Get all repos for this org with installation info
		const allRepos = await callQuery<Repository[]>(
			convex,
			"scm:getRepositories",
			{ orgId }
		);

		// Track newly activated repos for scanning
		const newlyActivatedRepos: Array<{
			repoId: string;
			fullName: string;
			installationId: string;
		}> = [];

		// Update each repo's active status
		for (const repo of allRepos) {
			const shouldBeActive = repoIds.includes(repo._id);
			if (repo.isActive !== shouldBeActive) {
				await callMutation(convex, "scm:setRepositoryActive", {
					repoId: repo._id,
					isActive: shouldBeActive,
				});

				// Track newly activated repos
				if (shouldBeActive && !repo.isActive) {
					newlyActivatedRepos.push({
						repoId: repo._id,
						fullName: repo.fullName,
						installationId: repo.scmInstallationId,
					});
				}
			}
		}

		// Trigger scans for newly activated repos (async, don't block response)
		const scanPromises = newlyActivatedRepos.map(async (repo) => {
			try {
				// Get installation details for the providerInstallationId
				const installation = await callQuery<Installation | null>(
					convex,
					"scm:getInstallationById",
					{ installationId: repo.installationId }
				);

				if (!installation) {
					console.error(`Installation not found for ${repo.fullName}`);
					return { repoId: repo.repoId, status: "failed", error: "Installation not found" };
				}

				// Create scan record
				const { scanId, alreadyRunning } = await callMutation<{
					scanId: string;
					alreadyRunning: boolean;
				}>(convex, "scans:createScan", {
					repositoryId: repo.repoId,
					triggeredBy: "onboarding",
				});

				if (alreadyRunning) {
					return { repoId: repo.repoId, scanId, status: "already_running" };
				}

				// Trigger background scan (fire and forget)
				// Use fetch to call the scan execute API
				fetch(`${APP_URL}/api/scans/execute`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Internal-Key": INTERNAL_API_KEY,
					},
					body: JSON.stringify({
						scanId,
						repositoryId: repo.repoId,
						installationId: installation.providerInstallationId,
						fullName: repo.fullName,
					}),
				}).catch((error) => {
					console.error(`Failed to trigger scan for ${repo.fullName}:`, error);
				});

				return { repoId: repo.repoId, scanId, status: "triggered" };
			} catch (error) {
				console.error(`Failed to setup scan for ${repo.fullName}:`, error);
				return {
					repoId: repo.repoId,
					status: "failed",
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		});

		// Wait for scan setup (but not completion)
		const scanResults = await Promise.all(scanPromises);

		return NextResponse.json({
			success: true,
			scansTriggered: scanResults.filter((r) => r.status === "triggered").length,
			scansAlreadyRunning: scanResults.filter((r) => r.status === "already_running").length,
			scansFailed: scanResults.filter((r) => r.status === "failed").length,
		});
	} catch (error) {
		console.error("Failed to save repos:", error);
		return NextResponse.json(
			{ error: "Failed to save repositories" },
			{ status: 500 }
		);
	}
}
