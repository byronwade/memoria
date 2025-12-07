import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { generateGitHubOAuthUrl } from "@/lib/github/auth";

/**
 * GET /api/auth/github
 * Initiates GitHub OAuth flow by redirecting to GitHub authorization page
 */
export async function GET(request: NextRequest) {
	// Generate CSRF state token
	const state = randomBytes(32).toString("hex");

	// Build GitHub OAuth URL
	const githubUrl = generateGitHubOAuthUrl(state);

	// Create redirect response
	const response = NextResponse.redirect(githubUrl);

	// Store state in secure cookie for validation in callback
	// Always use secure when APP_URL is https (including tunnels)
	const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
	const isSecure = appUrl.startsWith("https://");

	response.cookies.set("github_oauth_state", state, {
		httpOnly: true,
		secure: isSecure,
		sameSite: "lax",
		maxAge: 600, // 10 minutes
		path: "/",
	});

	return response;
}
