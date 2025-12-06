import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getConvexClient, callQuery, callMutation } from "@/lib/convex";
import { getInstallation } from "@/lib/github/auth";

/**
 * POST /api/github/refresh-installations
 * Refresh installation status from GitHub API
 * This is used to catch uninstalls/suspensions that weren't received via webhook
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

		// Get user's organizations
		const orgs = await callQuery<Array<{ _id: string }>>(
			convex,
			"orgs:getUserOrganizations",
			{ userId: session.user._id }
		);

		if (!orgs || orgs.length === 0) {
			return NextResponse.json({ error: "No organization found" }, { status: 400 });
		}

		const orgId = orgs[0]._id;

		// Get all installations for this org (including deleted/suspended)
		const installations = await callQuery<
			Array<{
				_id: string;
				providerInstallationId: string;
				status: string;
				accountLogin: string;
			}>
		>(convex, "scm:getInstallations", { orgId });

		if (!installations || installations.length === 0) {
			return NextResponse.json({
				success: true,
				message: "No installations to check",
				updated: 0,
			});
		}

		let updated = 0;
		const results: Array<{
			installationId: string;
			accountLogin: string;
			previousStatus: string;
			newStatus: string;
			error?: string;
		}> = [];

		// Check each installation against GitHub
		for (const inst of installations) {
			// Skip already deleted installations
			if (inst.status === "deleted") {
				results.push({
					installationId: inst.providerInstallationId,
					accountLogin: inst.accountLogin,
					previousStatus: inst.status,
					newStatus: "deleted",
				});
				continue;
			}

			try {
				// Try to get installation from GitHub
				const githubInstallation = await getInstallation(
					parseInt(inst.providerInstallationId)
				);

				// Check if suspended
				const isSuspended = (githubInstallation as { suspended_at?: string | null }).suspended_at !== null;
				const newStatus = isSuspended ? "suspended" : "active";

				if (newStatus !== inst.status) {
					// Update status in database
					await callMutation(convex, "scm:upsertInstallation", {
						providerType: "github",
						providerInstallationId: inst.providerInstallationId,
						orgId,
						accountType: "user", // We don't need to update this
						accountLogin: inst.accountLogin,
						accountName: null,
						permissions: {},
						status: newStatus,
					});
					updated++;
				}

				results.push({
					installationId: inst.providerInstallationId,
					accountLogin: inst.accountLogin,
					previousStatus: inst.status,
					newStatus,
				});
			} catch (error: unknown) {
				// If we get a 404, the installation was deleted
				const isNotFound =
					error instanceof Error &&
					(error.message.includes("404") || error.message.includes("Not Found"));

				if (isNotFound) {
					// Mark as deleted
					await callMutation(convex, "scm:upsertInstallation", {
						providerType: "github",
						providerInstallationId: inst.providerInstallationId,
						orgId,
						accountType: "user",
						accountLogin: inst.accountLogin,
						accountName: null,
						permissions: {},
						status: "deleted",
					});
					updated++;

					results.push({
						installationId: inst.providerInstallationId,
						accountLogin: inst.accountLogin,
						previousStatus: inst.status,
						newStatus: "deleted",
					});
				} else {
					// Other error - log but continue
					console.error(
						`Failed to check installation ${inst.providerInstallationId}:`,
						error
					);
					results.push({
						installationId: inst.providerInstallationId,
						accountLogin: inst.accountLogin,
						previousStatus: inst.status,
						newStatus: inst.status,
						error: error instanceof Error ? error.message : "Unknown error",
					});
				}
			}
		}

		return NextResponse.json({
			success: true,
			updated,
			results,
		});
	} catch (error) {
		console.error("Failed to refresh installations:", error);
		return NextResponse.json(
			{ error: "Failed to refresh installations" },
			{ status: 500 }
		);
	}
}
