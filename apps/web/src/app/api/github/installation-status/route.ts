import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getConvexClient, callQuery, callMutation } from "@/lib/convex";
import { listInstallationRepos } from "@/lib/github/auth";

/**
 * GET /api/github/installation-status
 * Check if the user has a GitHub installation
 */
export async function GET(request: NextRequest) {
	try {
		const cookieStore = await cookies();
		const sessionToken = cookieStore.get("session_token")?.value;

		console.log("[installation-status] Session token:", sessionToken ? "present" : "missing");

		if (!sessionToken) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const convex = getConvexClient();

		// Get session and user
		const session = await callQuery<{
			user: { _id: string };
		} | null>(convex, "auth:getSession", { sessionToken });

		console.log("[installation-status] Session user:", session?.user?._id || "none");

		if (!session?.user) {
			return NextResponse.json({ error: "Invalid session" }, { status: 401 });
		}

		const userId = session.user._id;

		// Get installations for the user
		console.log("[installation-status] Checking user:", userId);

		const allInstallations = await callQuery<
			Array<{
				_id: string;
				accountLogin: string;
				status: string;
				providerInstallationId: string;
			}>
		>(convex, "scm:getInstallations", { userId });

		// Filter to only active installations (exclude deleted/suspended)
		const installations = allInstallations?.filter(i => i.status === "active") || [];

		console.log("[installation-status] Installations found:", allInstallations?.length || 0, "active:", installations.length);

		// Get repositories if there are installations
		let repositories: Array<{
			_id: string;
			fullName: string;
			isActive: boolean;
			isPrivate: boolean;
		}> = [];

		if (installations && installations.length > 0) {
			repositories = await callQuery<typeof repositories>(
				convex,
				"scm:getRepositories",
				{ userId }
			);
			console.log("[installation-status] Repositories found:", repositories?.length || 0);
		}

		const result = {
			hasInstallation: installations && installations.length > 0,
			installations: installations || [],
			repositories: repositories || [],
		};

		console.log("[installation-status] Returning:", JSON.stringify(result));

		return NextResponse.json(result);
	} catch (error) {
		console.error("Failed to check installation status:", error);
		return NextResponse.json(
			{ error: "Failed to check installation status" },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/github/installation-status
 * Resync repositories from GitHub installation
 */
export async function POST(request: NextRequest) {
	try {
		const cookieStore = await cookies();
		const sessionToken = cookieStore.get("session_token")?.value;

		if (!sessionToken) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const convex = getConvexClient();

		// Get session and user
		const session = await callQuery<{
			user: { _id: string };
		} | null>(convex, "auth:getSession", { sessionToken });

		if (!session?.user) {
			return NextResponse.json({ error: "Invalid session" }, { status: 401 });
		}

		const userId = session.user._id;

		// Get installations
		const installations = await callQuery<
			Array<{
				_id: string;
				providerInstallationId: string;
			}>
		>(convex, "scm:getInstallations", { userId });

		if (!installations || installations.length === 0) {
			return NextResponse.json({ error: "No installation found" }, { status: 400 });
		}

		// Sync repos from each installation
		let totalSynced = 0;
		for (const inst of installations) {
			console.log(`[resync] Syncing repos for installation ${inst.providerInstallationId}`);
			const repos = await listInstallationRepos(parseInt(inst.providerInstallationId));

			for (const repo of repos) {
				await callMutation(convex, "scm:upsertRepository", {
					userId,
					scmInstallationId: inst._id,
					providerType: "github",
					providerRepoId: String(repo.id),
					fullName: repo.full_name,
					defaultBranch: repo.default_branch || "main",
					isPrivate: repo.private,
					isActive: false, // Keep existing isActive status or default to false
					languageHint: repo.language || null,
					settings: null,
				});
			}
			totalSynced += repos.length;
		}

		console.log(`[resync] Total repos synced: ${totalSynced}`);

		return NextResponse.json({
			success: true,
			synced: totalSynced,
			message: `Synced ${totalSynced} repositories`
		});
	} catch (error) {
		console.error("Failed to resync repositories:", error);
		return NextResponse.json(
			{ error: "Failed to resync repositories" },
			{ status: 500 }
		);
	}
}
