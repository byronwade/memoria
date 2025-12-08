import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callMutation } from "@/lib/convex";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * GET /api/auth/memoria/callback
 * OAuth callback endpoint for MCP clients
 * Called after user authorizes (logs in)
 * Generates a team token and redirects back to the MCP client
 */
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const state = searchParams.get("state");
	const client_id = searchParams.get("client_id");
	const redirect_uri = searchParams.get("redirect_uri");
	const scope = searchParams.get("scope") || "read";

	// Get stored state from cookie
	const cookieStore = await request.cookies;
	const storedState = cookieStore.get("memoria_oauth_state")?.value;
	const clientState = cookieStore.get("memoria_oauth_client_state")?.value;

	// Validate state (CSRF protection)
	if (!state || state !== storedState) {
		return NextResponse.json({ error: "Invalid state parameter" }, { status: 400 });
	}

	// Validate required parameters
	if (!client_id) {
		return NextResponse.json({ error: "client_id is required" }, { status: 400 });
	}

	if (!redirect_uri) {
		return NextResponse.json({ error: "redirect_uri is required" }, { status: 400 });
	}

	// Get user session
	const session = await getSession();
	if (!session) {
		// Not logged in - redirect to login with callback info
		const loginUrl = new URL("/login", APP_URL);
		loginUrl.searchParams.set("redirect", `/api/auth/memoria/callback`);
		loginUrl.searchParams.set("state", state);
		loginUrl.searchParams.set("client_id", client_id);
		loginUrl.searchParams.set("redirect_uri", redirect_uri);
		loginUrl.searchParams.set("scope", scope);
		return NextResponse.redirect(loginUrl);
	}

	// User is authenticated - generate team token
	const convex = getConvexClient();
	const tokenName = `OAuth - ${client_id} - ${new Date().toISOString()}`;

	try {
		const { token } = await callMutation<{ tokenId: string; token: string }>(
			convex,
			"teamTokens:createToken",
			{
				userId: session.user._id,
				name: tokenName,
				createdBy: session.user._id,
			}
		);

		// Build redirect URL with token
		const redirectUrl = new URL(redirect_uri);
		redirectUrl.searchParams.set("access_token", token);
		redirectUrl.searchParams.set("token_type", "bearer");
		if (clientState) {
			redirectUrl.searchParams.set("state", clientState);
		}

		// Clear OAuth cookies
		const response = NextResponse.redirect(redirectUrl);
		response.cookies.delete("memoria_oauth_state");
		response.cookies.delete("memoria_oauth_client_state");

		return response;
	} catch (error) {
		console.error("Failed to create token:", error);
		return NextResponse.json(
			{ error: "Failed to generate access token" },
			{ status: 500 }
		);
	}
}
