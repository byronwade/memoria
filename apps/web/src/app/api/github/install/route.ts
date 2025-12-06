import { NextRequest, NextResponse } from "next/server";
import { generateInstallUrl } from "@/lib/github/auth";

/**
 * GET /api/github/install
 * Redirects to GitHub App installation page
 * Optionally passes org ID in state for post-install linking
 */
export async function GET(request: NextRequest) {
	// Get optional org ID from query params
	const orgId = request.nextUrl.searchParams.get("org");

	// Generate installation URL with optional state
	const installUrl = generateInstallUrl(orgId || undefined);

	return NextResponse.redirect(installUrl);
}
