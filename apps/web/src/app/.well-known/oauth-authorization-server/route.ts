import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://memoria.byronwade.com";

/**
 * GET /.well-known/oauth-authorization-server
 * Authorization Server Metadata for MCP OAuth 2.1 compliance
 * RFC 8414: OAuth 2.0 Authorization Server Metadata
 *
 * This endpoint provides OAuth 2.1 configuration for MCP clients like Cursor.
 */
export async function GET(request: NextRequest) {
	const baseUrl = APP_URL;

	return NextResponse.json({
		// Issuer identifier (MUST match the URL of this metadata document)
		issuer: baseUrl,

		// OAuth endpoints
		authorization_endpoint: `${baseUrl}/api/auth/memoria/authorize`,
		token_endpoint: `${baseUrl}/api/auth/memoria/token`,

		// Optional: Dynamic Client Registration (recommended for MCP)
		// registration_endpoint: `${baseUrl}/api/auth/memoria/register`,

		// Supported grant types
		grant_types_supported: ["authorization_code", "refresh_token"],

		// Supported response types
		response_types_supported: ["code"],

		// PKCE is MANDATORY for MCP OAuth 2.1
		code_challenge_methods_supported: ["S256"],

		// Token endpoint authentication methods
		// "none" is important for public clients like Cursor
		token_endpoint_auth_methods_supported: [
			"client_secret_basic",
			"client_secret_post",
			"none"
		],

		// Scopes supported
		scopes_supported: [
			"read",
			"write",
			"mcp:tools:analyze_file",
			"mcp:tools:ask_history",
			"mcp:resources:read"
		],

		// Response modes supported
		response_modes_supported: ["query"],

		// Service documentation
		service_documentation: "https://github.com/byronwade/memoria",

		// UI locales supported
		ui_locales_supported: ["en"]
	}, {
		headers: {
			"Cache-Control": "public, max-age=3600",
			"Access-Control-Allow-Origin": "*",
		}
	});
}
