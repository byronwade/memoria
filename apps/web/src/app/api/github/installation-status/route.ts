import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getConvexClient, callQuery, callMutation } from "@/lib/convex";
import { listInstallationRepos, listUserInstallations } from "@/lib/github/auth";

/**
 * GET /api/github/installation-status
 * Check if the user has a GitHub installation
 * Also discovers new installations from GitHub API if none found in database
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

		// Get installations for the user from database
		console.log("[installation-status] Checking user:", userId);

		let allInstallations = await callQuery<
			Array<{
				_id: string;
				accountLogin: string;
				status: string;
				providerInstallationId: string;
			}>
		>(convex, "scm:getInstallations", { userId });

		// Filter to only active installations (exclude deleted/suspended)
		let installations = allInstallations?.filter(i => i.status === "active") || [];

		console.log("[installation-status] Installations in DB:", allInstallations?.length || 0, "active:", installations.length);

		// If no installations found, try to discover them from GitHub API
		if (installations.length === 0) {
			console.log("[installation-status] No installations in DB, checking GitHub API...");

			// Get user's GitHub access token from identity
			const identity = await callQuery<{
				accessToken: string | null;
			} | null>(convex, "auth:getUserGitHubIdentity", { userId });

			if (identity?.accessToken) {
				try {
					// Query GitHub for installations accessible to this user
					const githubInstallations = await listUserInstallations(identity.accessToken);
					console.log("[installation-status] Found", githubInstallations.length, "installations from GitHub API");

					// Create installations in database
					for (const inst of githubInstallations) {
						const accountType = inst.account.type === "Organization" ? "org" : "user";
						const status = inst.suspended_at ? "suspended" : "active";

						await callMutation(convex, "scm:upsertInstallation", {
							providerType: "github",
							providerInstallationId: String(inst.id),
							userId,
							accountType: accountType as "user" | "org",
							accountLogin: inst.account.login,
							accountName: inst.account.name || null,
							permissions: inst.permissions,
							status,
						});

						console.log("[installation-status] Created installation:", inst.id, inst.account.login);

						// Sync repositories for this installation
						if (status === "active") {
							try {
								const repos = await listInstallationRepos(inst.id);
								console.log("[installation-status] Syncing", repos.length, "repos for installation", inst.id);

								// Get the installation record we just created
								const dbInst = await callQuery<{ _id: string } | null>(
									convex,
									"scm:getInstallationByProviderId",
									{ providerType: "github", providerInstallationId: String(inst.id) }
								);

								if (dbInst) {
									for (const repo of repos) {
										await callMutation(convex, "scm:upsertRepository", {
											userId,
											scmInstallationId: dbInst._id,
											providerType: "github",
											providerRepoId: String(repo.id),
											fullName: repo.full_name,
											defaultBranch: repo.default_branch || "main",
											isPrivate: repo.private,
											isActive: false,
											languageHint: repo.language || null,
											settings: null,
										});
									}
								}
							} catch (repoError) {
								console.error("[installation-status] Failed to sync repos:", repoError);
							}
						}
					}

					// Re-fetch installations from database
					allInstallations = await callQuery<typeof allInstallations>(
						convex, "scm:getInstallations", { userId }
					);
					installations = allInstallations?.filter(i => i.status === "active") || [];
				} catch (githubError) {
					console.error("[installation-status] Failed to query GitHub:", githubError);
				}
			} else {
				console.log("[installation-status] No GitHub access token available");
			}
		}

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
