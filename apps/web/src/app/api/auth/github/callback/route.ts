import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
	exchangeCodeForToken,
	getGitHubUser,
	getGitHubUserEmail,
	getInstallation,
	listInstallationRepos,
} from "@/lib/github/auth";
import { getConvexClient, callMutation, callQuery } from "@/lib/convex";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * GET /api/auth/github/callback
 * Handles GitHub OAuth callback, creates user/session, redirects to dashboard
 * Also handles GitHub App installation when "Request user authorization (OAuth) during installation" is enabled
 */
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const code = searchParams.get("code");
	const state = searchParams.get("state");
	const error = searchParams.get("error");
	const storedState = request.cookies.get("github_oauth_state")?.value;

	// GitHub App installation parameters (sent when installing app during OAuth)
	const installationId = searchParams.get("installation_id");
	const setupAction = searchParams.get("setup_action"); // "install" | "update" | "request"

	console.log("[oauth-callback] Received:", {
		hasCode: !!code,
		state,
		storedState,
		installationId,
		setupAction
	});

	// Handle OAuth errors from GitHub
	if (error) {
		const errorDescription = searchParams.get("error_description") || error;
		console.error("GitHub OAuth error:", errorDescription);
		return NextResponse.redirect(
			new URL(`/login?error=${encodeURIComponent(errorDescription)}`, APP_URL)
		);
	}

	// Check if this is an installation-only callback (user already logged in, just installing app)
	// This happens when user clicks "Install GitHub App" from onboarding page
	if (installationId && !code) {
		console.log("[oauth-callback] Installation-only flow detected, redirecting to /api/github/callback");
		// Redirect to the dedicated installation callback handler
		const installCallbackUrl = new URL("/api/github/callback", APP_URL);
		installCallbackUrl.searchParams.set("installation_id", installationId);
		if (setupAction) installCallbackUrl.searchParams.set("setup_action", setupAction);
		return NextResponse.redirect(installCallbackUrl);
	}

	// If we have installation_id with invalid/missing state, check for existing session
	// This happens when user installs from onboarding page (already logged in)
	if (installationId && (!state || state !== storedState)) {
		const existingSessionToken = request.cookies.get("session_token")?.value;
		if (existingSessionToken) {
			console.log("[oauth-callback] User has existing session, redirecting to installation handler");
			// User is already logged in, just process the installation
			const redirectUrl = new URL("/api/github/callback", APP_URL);
			redirectUrl.searchParams.set("installation_id", installationId);
			if (setupAction) redirectUrl.searchParams.set("setup_action", setupAction);
			return NextResponse.redirect(redirectUrl);
		}
		// No existing session - if we have code, continue with OAuth (skip state check)
		// If no code, redirect to login
		if (!code) {
			console.log("[oauth-callback] No session and no code, redirecting to login");
			return NextResponse.redirect(new URL("/login?error=missing_code", APP_URL));
		}
		console.log("[oauth-callback] No session but have code, completing OAuth without state validation");
	} else if (!installationId) {
		// Standard OAuth flow (no installation) - validate CSRF state strictly
		if (!code) {
			return NextResponse.redirect(
				new URL("/login?error=missing_code", APP_URL)
			);
		}

		if (!state || state !== storedState) {
			console.error("OAuth state mismatch:", { state, storedState });
			return NextResponse.redirect(
				new URL("/login?error=invalid_state", APP_URL)
			);
		}
	}
	// else: we have both installationId AND valid state - normal flow

	// At this point, we must have a code to continue
	if (!code) {
		return NextResponse.redirect(
			new URL("/login?error=missing_code", APP_URL)
		);
	}

	try {
		// Exchange code for access token
		const tokenResponse = await exchangeCodeForToken(code);

		if (tokenResponse.error || !tokenResponse.access_token) {
			console.error("Token exchange failed:", tokenResponse.error_description);
			return NextResponse.redirect(
				new URL("/login?error=token_exchange_failed", APP_URL)
			);
		}

		// Get GitHub user profile
		const githubUser = await getGitHubUser(tokenResponse.access_token);

		// Get user email (may need separate call if email is private)
		let email = githubUser.email;
		if (!email) {
			email = await getGitHubUserEmail(tokenResponse.access_token);
		}

		// Fallback email if still not available
		if (!email) {
			email = `${githubUser.id}@users.noreply.github.com`;
		}

		// Initialize Convex client
		const convex = getConvexClient();

		// Upsert user with GitHub identity
		const { userId } = await callMutation<{ userId: string }>(
			convex,
			"auth:upsertUserWithIdentity",
			{
				email,
				emailVerified: !!githubUser.email, // Only verified if GitHub provided it directly
				name: githubUser.name,
				avatarUrl: githubUser.avatar_url,
				provider: "github",
				providerUserId: String(githubUser.id),
				accessToken: tokenResponse.access_token,
				refreshToken: tokenResponse.refresh_token || null,
				expiresAt: tokenResponse.expires_in
					? Date.now() + tokenResponse.expires_in * 1000
					: null,
				metadata: {
					login: githubUser.login,
					scope: tokenResponse.scope,
				},
			}
		);

		// Generate session token
		const sessionToken = randomBytes(32).toString("hex");
		const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

		// Create session in database
		await callMutation(convex, "auth:createSession", {
			userId,
			sessionToken,
			userAgent: request.headers.get("user-agent"),
			ipAddress:
				request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
				request.headers.get("x-real-ip") ||
				null,
			expiresAt,
		});

		// Check if user has any organizations
		const userOrgs = await callQuery<Array<{ _id: string }>>(
			convex,
			"orgs:getUserOrganizations",
			{ userId }
		);

		let redirectUrl = "/dashboard";
		let orgId: string | null = userOrgs?.[0]?._id || null;

		// If no organizations, create one and redirect to onboarding
		if (!userOrgs || userOrgs.length === 0) {
			// Create a personal organization for the user
			const slug = githubUser.login.toLowerCase().replace(/[^a-z0-9-]/g, "-");
			const orgName = githubUser.name || githubUser.login;

			// Get free plan
			const freePlan = await callQuery<{ _id: string } | null>(
				convex,
				"billing:getPlanByTier",
				{ tier: "free" }
			);

			const result = await callMutation<{ orgId: string }>(convex, "orgs:createOrganization", {
				name: orgName,
				slug,
				ownerUserId: userId,
				planId: freePlan?._id,
			});

			orgId = result.orgId;
			redirectUrl = "/onboarding";
		}

		// Handle GitHub App installation if installation_id is present
		if (installationId && orgId) {
			console.log("[oauth-callback] Processing installation:", installationId);
			try {
				// Get installation details from GitHub
				const installation = await getInstallation(parseInt(installationId));
				const account = installation.account as { login?: string; name?: string; type?: string } | null;
				const accountLogin = account?.login || "unknown";
				const accountName = account?.name || null;
				const accountType = account?.type === "Organization" ? "org" : "user";

				// Create/update installation in database
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

				console.log("[oauth-callback] Installation created for org:", orgId);

				// Get the installation ID from database to sync repos
				const inst = await callQuery<{ _id: string } | null>(
					convex,
					"scm:getInstallationByProviderId",
					{ providerType: "github", providerInstallationId: String(installationId) }
				);

				if (inst) {
					// Sync repositories from this installation
					const repos = await listInstallationRepos(parseInt(installationId));
					console.log("[oauth-callback] Syncing", repos.length, "repositories");

					for (const repo of repos) {
						await callMutation(convex, "scm:upsertRepository", {
							orgId,
							scmInstallationId: inst._id,
							providerType: "github",
							providerRepoId: String(repo.id),
							fullName: repo.full_name,
							defaultBranch: repo.default_branch || "main",
							isPrivate: repo.private,
							isActive: false, // Will be activated during onboarding
							languageHint: repo.language || null,
							settings: null,
						});
					}
				}

				// User installed app, so they should go to onboarding to select repos
				redirectUrl = "/onboarding";
			} catch (installError) {
				console.error("[oauth-callback] Installation processing failed:", installError);
				// Don't fail the login, just skip installation processing
			}
		}

		// Create response with redirect
		const response = NextResponse.redirect(new URL(redirectUrl, APP_URL));

		// Set session cookie
		response.cookies.set("session_token", sessionToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			expires: new Date(expiresAt),
			path: "/",
		});

		// Clear OAuth state cookie
		response.cookies.delete("github_oauth_state");

		return response;
	} catch (error) {
		console.error("GitHub OAuth callback error:", error);
		const errorMessage = error instanceof Error ? error.message : "oauth_failed";
		return NextResponse.redirect(
			new URL(`/login?error=${encodeURIComponent(errorMessage)}`, APP_URL)
		);
	}
}
