import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * GET /api/auth/memoria/authorize
 * OAuth 2.1 authorization endpoint for MCP clients (like Cursor)
 *
 * Supports:
 * - Standard OAuth 2.1 authorization code flow
 * - PKCE (Proof Key for Code Exchange) - MANDATORY for MCP
 * - Custom redirect URIs (cursor://, https://)
 *
 * Query Parameters:
 * - client_id: Client identifier
 * - redirect_uri: Where to redirect after auth (cursor:// or https://)
 * - response_type: Must be "code"
 * - state: Client state for CSRF protection
 * - scope: Requested scopes (default: "read")
 * - code_challenge: PKCE challenge (base64url-encoded SHA-256 hash)
 * - code_challenge_method: Must be "S256" (required when code_challenge is present)
 * - resource: Optional resource indicator (RFC 8707)
 */
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const client_id = searchParams.get("client_id");
	const redirect_uri = searchParams.get("redirect_uri");
	const response_type = searchParams.get("response_type");
	const state = searchParams.get("state");
	const scope = searchParams.get("scope") || "read";

	// PKCE parameters (mandatory for MCP OAuth 2.1)
	const code_challenge = searchParams.get("code_challenge");
	const code_challenge_method = searchParams.get("code_challenge_method");

	// Resource indicator (RFC 8707)
	const resource = searchParams.get("resource");

	// Validate response_type
	if (response_type && response_type !== "code") {
		return NextResponse.json({
			error: "unsupported_response_type",
			error_description: "Only 'code' response type is supported"
		}, { status: 400 });
	}

	// Validate required parameters
	if (!client_id) {
		return NextResponse.json({
			error: "invalid_request",
			error_description: "client_id is required"
		}, { status: 400 });
	}

	if (!redirect_uri) {
		return NextResponse.json({
			error: "invalid_request",
			error_description: "redirect_uri is required"
		}, { status: 400 });
	}

	// Validate redirect_uri (must be cursor:// or https://)
	try {
		const redirectUrl = new URL(redirect_uri);
		if (!redirectUrl.protocol.match(/^(cursor|https|http):$/)) {
			return NextResponse.json({
				error: "invalid_request",
				error_description: "Invalid redirect_uri protocol. Must be cursor:// or https://"
			}, { status: 400 });
		}
		// Allow http only for localhost
		if (redirectUrl.protocol === "http:" && !redirectUrl.hostname.match(/^(localhost|127\.0\.0\.1)$/)) {
			return NextResponse.json({
				error: "invalid_request",
				error_description: "HTTP redirect_uri only allowed for localhost"
			}, { status: 400 });
		}
	} catch {
		return NextResponse.json({
			error: "invalid_request",
			error_description: "Invalid redirect_uri format"
		}, { status: 400 });
	}

	// Validate PKCE if provided (code_challenge_method must be S256)
	if (code_challenge) {
		if (code_challenge_method !== "S256") {
			return NextResponse.json({
				error: "invalid_request",
				error_description: "code_challenge_method must be S256"
			}, { status: 400 });
		}
		// Validate code_challenge format (base64url, 43 characters for SHA-256)
		if (!/^[A-Za-z0-9_-]{43}$/.test(code_challenge)) {
			return NextResponse.json({
				error: "invalid_request",
				error_description: "Invalid code_challenge format"
			}, { status: 400 });
		}
	}

	// Generate CSRF state token
	const csrfState = randomBytes(32).toString("hex");

	// Build login redirect URL
	const loginUrl = new URL("/login", APP_URL);
	loginUrl.searchParams.set("redirect", "/api/auth/memoria/callback");
	loginUrl.searchParams.set("state", csrfState);
	loginUrl.searchParams.set("client_id", client_id);
	loginUrl.searchParams.set("redirect_uri", redirect_uri);
	loginUrl.searchParams.set("scope", scope);

	const response = NextResponse.redirect(loginUrl);

	// Store state in cookie (expires in 10 minutes)
	const cookieOptions = {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax" as const,
		maxAge: 600, // 10 minutes
		path: "/",
	};

	response.cookies.set("memoria_oauth_state", csrfState, cookieOptions);

	// Store the original state from client for CSRF
	if (state) {
		response.cookies.set("memoria_oauth_client_state", state, cookieOptions);
	}

	// Store OAuth parameters for redirect after login
	response.cookies.set("memoria_oauth_client_id", client_id, cookieOptions);
	response.cookies.set("memoria_oauth_redirect_uri", redirect_uri, cookieOptions);
	response.cookies.set("memoria_oauth_scope", scope, cookieOptions);

	// Store PKCE challenge for token exchange
	if (code_challenge) {
		response.cookies.set("memoria_oauth_code_challenge", code_challenge, cookieOptions);
	}

	// Store resource indicator if provided
	if (resource) {
		response.cookies.set("memoria_oauth_resource", resource, cookieOptions);
	}

	return response;
}
