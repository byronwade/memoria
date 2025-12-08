import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://memoria.byronwade.com";

/**
 * GET /api/mcp/manifest.json
 * MCP manifest for Cursor and other MCP clients
 *
 * This endpoint provides the MCP server configuration including:
 * - Server metadata (name, version, description)
 * - Available endpoints (stdio for local, HTTP for remote)
 * - OAuth 2.1 configuration for authentication
 *
 * Clients can use this to auto-configure the MCP server.
 */
export async function GET(request: NextRequest) {
	const baseUrl = APP_URL;

	return NextResponse.json({
		// MCP manifest schema version
		schema_version: "1.0",

		// Server metadata
		name: "memoria",
		version: "1.0.0",
		description: "Memoria MCP Server - The Memory Your AI Lacks. Provides file risk analysis, coupling detection, and git history search.",

		// Available tools
		tools: [
			{
				name: "analyze_file",
				description: "Analyze file coupling, risk score, and dependencies before making changes"
			},
			{
				name: "ask_history",
				description: "Search git history to understand why code was written a certain way"
			},
			{
				name: "login",
				description: "Link this device to your Memoria cloud account"
			}
		],

		// Server endpoints
		endpoints: [
			{
				// Local stdio mode (default, works offline)
				type: "stdio",
				command: "npx",
				args: ["-y", "@byronwade/memoria"],
				description: "Local installation - works offline with git-based analysis"
			},
			{
				// Remote HTTP mode (requires authentication)
				type: "http",
				url: `${baseUrl}/api/mcp`,
				description: "Remote server - requires authentication for cloud features"
			}
		],

		// OAuth 2.1 configuration (MCP spec compliant)
		authorization: {
			// OAuth 2.1 with PKCE
			type: "oauth2",

			// Default client ID (clients can use their own)
			client_id: "memoria-mcp",

			// OAuth endpoints
			authorization_url: `${baseUrl}/api/auth/memoria/authorize`,
			token_url: `${baseUrl}/api/auth/memoria/token`,

			// Well-known metadata endpoints (RFC 8414, RFC 9728)
			authorization_server_metadata: `${baseUrl}/.well-known/oauth-authorization-server`,
			protected_resource_metadata: `${baseUrl}/.well-known/oauth-protected-resource`,

			// Supported scopes
			scopes: ["read", "write", "mcp:tools:analyze_file", "mcp:tools:ask_history"],

			// PKCE is mandatory for MCP OAuth 2.1
			pkce_required: true,
			code_challenge_methods: ["S256"]
		},

		// Documentation links
		documentation: "https://github.com/byronwade/memoria",
		homepage: baseUrl
	}, {
		headers: {
			"Cache-Control": "public, max-age=3600",
			"Access-Control-Allow-Origin": "*",
		}
	});
}
