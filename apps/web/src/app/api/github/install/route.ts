import { NextRequest, NextResponse } from "next/server";
import { generateInstallUrl } from "@/lib/github/auth";

/**
 * GET /api/github/install
 * Redirects to GitHub App installation page
 */
export async function GET(request: NextRequest) {
	// Generate installation URL (no state needed without orgs)
	const installUrl = generateInstallUrl();

	return NextResponse.redirect(installUrl);
}
