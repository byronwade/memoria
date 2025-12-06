import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy to protect dashboard and onboarding routes
 * Validates session token cookie exists, then lets the page handle validation
 *
 * Note: We can't call Convex from proxy reliably, so we do a simple
 * cookie check here and let server components validate the session properly.
 */
export async function proxy(request: NextRequest) {
	const sessionToken = request.cookies.get("session_token")?.value;

	// No session token - redirect to login
	if (!sessionToken) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
		return NextResponse.redirect(loginUrl);
	}

	// Session token exists - let the request through
	// The page/layout will validate the session with Convex
	return NextResponse.next();
}

/**
 * Configure which routes the proxy applies to
 */
export const config = {
	matcher: [
		// Protect all dashboard routes
		"/dashboard/:path*",
		// Protect onboarding
		"/onboarding/:path*",
	],
};
