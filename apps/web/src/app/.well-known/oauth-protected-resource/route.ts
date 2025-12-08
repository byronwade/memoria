import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://memoria.byronwade.com";

/**
 * GET /.well-known/oauth-protected-resource
 * Protected Resource Metadata for MCP OAuth 2.1 compliance
 * RFC 9728: OAuth 2.0 Protected Resource Metadata
 *
 * This endpoint tells MCP clients where to find the authorization server
 * and what scopes are available.
 */
export async function GET(request: NextRequest) {
	const baseUrl = APP_URL;

	return NextResponse.json({
		// The canonical URL of the MCP resource
		resource: `${baseUrl}/api/mcp`,

		// Authorization servers that can issue tokens for this resource
		authorization_servers: [baseUrl],

		// How bearer tokens should be presented
		bearer_methods_supported: ["header"],

		// Documentation for the resource
		resource_documentation: "https://github.com/byronwade/memoria",

		// Scopes supported by this resource
		scopes_supported: [
			"read",
			"write",
			"mcp:tools:analyze_file",
			"mcp:tools:ask_history",
			"mcp:resources:read"
		]
	}, {
		headers: {
			"Cache-Control": "public, max-age=3600",
			"Access-Control-Allow-Origin": "*",
		}
	});
}
