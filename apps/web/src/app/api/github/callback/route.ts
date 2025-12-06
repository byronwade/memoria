import { NextRequest, NextResponse } from "next/server";
import { getInstallation, listInstallationRepos } from "@/lib/github/auth";
import { getConvexClient, callMutation, callQuery } from "@/lib/convex";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * GET /api/github/callback
 * Handles GitHub App installation callback
 * Links installation to user's organization and syncs repositories
 */
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const installationId = searchParams.get("installation_id");
	const setupAction = searchParams.get("setup_action"); // "install" | "update" | "request"
	const state = searchParams.get("state"); // Optional org ID

	console.log("[github-callback] Received callback:", { installationId, setupAction, state });

	// Validate installation ID
	if (!installationId) {
		console.log("[github-callback] Missing installation_id");
		return NextResponse.redirect(
			new URL("/dashboard?error=missing_installation_id", APP_URL)
		);
	}

	// Get session to identify user
	const sessionToken = request.cookies.get("session_token")?.value;
	if (!sessionToken) {
		// User not logged in - redirect to login with redirect back here
		const returnUrl = `/api/github/callback?installation_id=${installationId}&setup_action=${setupAction || ""}`;
		return NextResponse.redirect(
			new URL(`/login?redirect=${encodeURIComponent(returnUrl)}`, APP_URL)
		);
	}

	try {
		const convex = getConvexClient();

		// Validate session and get user
		const session = await callQuery<{ user: { _id: string; primaryOrgId?: string } } | null>(
			convex,
			"auth:getSession",
			{ sessionToken }
		);

		console.log("[github-callback] Session user:", session?.user?._id || "none");

		if (!session?.user) {
			return NextResponse.redirect(
				new URL("/login?error=session_expired", APP_URL)
			);
		}

		// Get installation details from GitHub
		console.log("[github-callback] Fetching installation from GitHub:", installationId);
		const installation = await getInstallation(parseInt(installationId));
		console.log("[github-callback] Installation account:", installation.account);

		// Extract account info - handle both User and Organization types
		// Both types have 'login' but TypeScript union type doesn't see it
		const account = installation.account as { login?: string; name?: string; type?: string } | null;
		const accountLogin = account?.login || "unknown";
		const accountName = account?.name || null;
		const accountType = account?.type === "Organization" ? "org" : "user";

		// Determine which org to link to - check state, then primaryOrgId, then query for user's orgs
		let orgId = state || session.user.primaryOrgId;

		// If no org from state or primaryOrgId, get user's existing organizations
		if (!orgId) {
			const userOrgs = await callQuery<Array<{ _id: string }>>(
				convex,
				"orgs:getUserOrganizations",
				{ userId: session.user._id }
			);
			console.log("[github-callback] User orgs found:", userOrgs?.length || 0);

			if (userOrgs && userOrgs.length > 0) {
				// Use the first (usually only) organization
				orgId = userOrgs[0]._id;
				console.log("[github-callback] Using existing org:", orgId);
			}
		}

		// If user still doesn't have an org, create one
		if (!orgId) {
			console.log("[github-callback] Creating new org for user");
			const { orgId: newOrgId } = await callMutation<{ orgId: string }>(
				convex,
				"orgs:createOrganization",
				{
					name: accountLogin || "My Organization",
					slug: (accountLogin || `org-${Date.now()}`).toLowerCase().replace(/[^a-z0-9-]/g, "-"),
					ownerUserId: session.user._id,
				}
			);
			orgId = newOrgId;
		}

		// Upsert installation in database
		console.log("[github-callback] Upserting installation for org:", orgId);
		await callMutation(convex, "scm:upsertInstallation", {
			providerType: "github",
			providerInstallationId: String(installationId),
			orgId,
			accountType: accountType as "user" | "org",
			accountLogin,
			accountName,
			permissions: installation.permissions,
			status: "active",
		});
		console.log("[github-callback] Installation upserted successfully");

		// Get the installation ID from database
		const inst = await callQuery<{ _id: string } | null>(
			convex,
			"scm:getInstallationByProviderId",
			{ providerType: "github", providerInstallationId: String(installationId) }
		);

		if (inst) {
			// Sync repositories from this installation
			const repos = await listInstallationRepos(parseInt(installationId));

			for (const repo of repos) {
				await callMutation(convex, "scm:upsertRepository", {
					orgId,
					scmInstallationId: inst._id,
					providerType: "github",
					providerRepoId: String(repo.id),
					fullName: repo.full_name,
					defaultBranch: repo.default_branch || "main",
					isPrivate: repo.private,
					isActive: true,
					languageHint: repo.language || null,
					settings: null,
				});
			}
		}

		// Close this window with a success message - the onboarding page will detect the installation
		// Return a simple HTML page that closes itself
		return new NextResponse(
			`<!DOCTYPE html>
			<html>
			<head><title>Installation Complete</title></head>
			<body>
				<script>
					// Post message to opener window
					if (window.opener) {
						window.opener.postMessage({ type: 'github-installation-complete', success: true }, '*');
					}
					// Close this window
					window.close();
					// If window didn't close (popup blockers), show success message
					setTimeout(() => {
						document.body.innerHTML = '<h2>Installation complete! You can close this tab.</h2>';
					}, 500);
				</script>
				<p>Installation complete! Closing window...</p>
			</body>
			</html>`,
			{
				headers: { 'Content-Type': 'text/html' },
			}
		);
	} catch (error) {
		console.error("GitHub installation callback error:", error);
		return new NextResponse(
			`<!DOCTYPE html>
			<html>
			<head><title>Installation Failed</title></head>
			<body>
				<h2>Installation failed</h2>
				<p>${error instanceof Error ? error.message : 'Unknown error'}</p>
				<p><a href="/onboarding">Return to onboarding</a></p>
			</body>
			</html>`,
			{
				headers: { 'Content-Type': 'text/html' },
			}
		);
	}
}
