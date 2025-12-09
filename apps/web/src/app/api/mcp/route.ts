import { NextRequest, NextResponse } from "next/server";
import { getConvexClient, callQuery } from "@/lib/convex";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://memoria.byronwade.com";

/**
 * MCP Protocol endpoint for Cursor and other MCP clients
 *
 * Implements MCP over HTTP with OAuth 2.1 authentication:
 * - Returns 401 with WWW-Authenticate header for unauthenticated requests
 * - Validates Bearer tokens against Convex teamTokens
 * - Returns MCP protocol responses for authenticated requests
 *
 * Note: This is a cloud endpoint. Full MCP functionality (git analysis)
 * requires the local stdio transport. This endpoint provides:
 * - OAuth flow initiation (401 response)
 * - Token validation
 * - Cloud-based memory/context features (future)
 */

// CORS headers for MCP clients
const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
	"Access-Control-Expose-Headers": "Mcp-Session-Id",
};

/**
 * Build WWW-Authenticate header for 401 responses
 * This tells Cursor how to authenticate
 */
function buildWwwAuthenticateHeader(): string {
	// RFC 9728 format for OAuth-protected resource
	return `Bearer resource_metadata="${APP_URL}/.well-known/oauth-protected-resource"`;
}

/**
 * Validate Bearer token against Convex
 */
async function validateToken(token: string): Promise<{ valid: boolean; userId?: string }> {
	try {
		const convex = getConvexClient();
		const result = await callQuery<{
			valid: boolean;
			userId?: string;
			error?: string;
		}>(convex, "teamTokens:validateToken", { token });
		return result;
	} catch (error) {
		console.error("Token validation error:", error);
		return { valid: false };
	}
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
	return new NextResponse(null, {
		status: 204,
		headers: corsHeaders,
	});
}

/**
 * GET handler - MCP server info / SSE endpoint
 */
export async function GET(request: NextRequest) {
	// Check for Authorization header
	const authHeader = request.headers.get("authorization");

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		// Return 401 with WWW-Authenticate to trigger OAuth flow
		return new NextResponse(
			JSON.stringify({
				error: "unauthorized",
				message: "Authentication required. Use OAuth 2.1 to obtain access token.",
				oauth_metadata: `${APP_URL}/.well-known/oauth-authorization-server`,
			}),
			{
				status: 401,
				headers: {
					...corsHeaders,
					"Content-Type": "application/json",
					"WWW-Authenticate": buildWwwAuthenticateHeader(),
				},
			}
		);
	}

	// Validate token
	const token = authHeader.substring(7);
	const validation = await validateToken(token);

	if (!validation.valid) {
		return new NextResponse(
			JSON.stringify({
				error: "invalid_token",
				message: "Access token is invalid or expired",
			}),
			{
				status: 401,
				headers: {
					...corsHeaders,
					"Content-Type": "application/json",
					"WWW-Authenticate": buildWwwAuthenticateHeader(),
				},
			}
		);
	}

	// Return MCP server capabilities for GET request
	return NextResponse.json(
		{
			jsonrpc: "2.0",
			result: {
				protocolVersion: "2024-11-05",
				serverInfo: {
					name: "memoria",
					version: "1.0.0",
				},
				capabilities: {
					tools: {},
					prompts: {},
					resources: {},
				},
			},
		},
		{ headers: corsHeaders }
	);
}

/**
 * POST handler - MCP JSON-RPC endpoint
 */
export async function POST(request: NextRequest) {
	// Check for Authorization header
	const authHeader = request.headers.get("authorization");

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		// Return 401 with WWW-Authenticate to trigger OAuth flow
		return new NextResponse(
			JSON.stringify({
				jsonrpc: "2.0",
				error: {
					code: -32001,
					message: "Authentication required",
					data: {
						oauth_metadata: `${APP_URL}/.well-known/oauth-authorization-server`,
					},
				},
				id: null,
			}),
			{
				status: 401,
				headers: {
					...corsHeaders,
					"Content-Type": "application/json",
					"WWW-Authenticate": buildWwwAuthenticateHeader(),
				},
			}
		);
	}

	// Validate token
	const token = authHeader.substring(7);
	const validation = await validateToken(token);

	if (!validation.valid) {
		return new NextResponse(
			JSON.stringify({
				jsonrpc: "2.0",
				error: {
					code: -32001,
					message: "Invalid or expired access token",
				},
				id: null,
			}),
			{
				status: 401,
				headers: {
					...corsHeaders,
					"Content-Type": "application/json",
					"WWW-Authenticate": buildWwwAuthenticateHeader(),
				},
			}
		);
	}

	// Parse MCP request
	let body: { jsonrpc?: string; method?: string; params?: unknown; id?: string | number | null };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{
				jsonrpc: "2.0",
				error: {
					code: -32700,
					message: "Parse error",
				},
				id: null,
			},
			{ status: 400, headers: corsHeaders }
		);
	}

	const { method, params, id } = body;

	// Handle MCP methods
	switch (method) {
		case "initialize":
			return NextResponse.json(
				{
					jsonrpc: "2.0",
					result: {
						protocolVersion: "2024-11-05",
						serverInfo: {
							name: "memoria",
							version: "1.0.0",
						},
						capabilities: {
							tools: {},
							prompts: {},
							resources: {},
						},
					},
					id,
				},
				{ headers: corsHeaders }
			);

		case "tools/list":
			return NextResponse.json(
				{
					jsonrpc: "2.0",
					result: {
						tools: [
							{
								name: "analyze_file",
								description:
									"Returns forensic history, hidden dependencies, and risk assessment. Note: Full git analysis requires local stdio transport. Cloud endpoint provides memory/context features.",
								inputSchema: {
									type: "object",
									properties: {
										path: {
											type: "string",
											description: "The ABSOLUTE path to the file",
										},
									},
									required: ["path"],
								},
							},
							{
								name: "ask_history",
								description:
									"Search git history for WHY code was written. Note: Requires local stdio transport for git access.",
								inputSchema: {
									type: "object",
									properties: {
										query: {
											type: "string",
											description: "A single keyword or short phrase (1-3 words max)",
										},
										path: {
											type: "string",
											description: "Optional: ABSOLUTE path to scope search",
										},
									},
									required: ["query"],
								},
							},
							{
								name: "get_context",
								description:
									"Get relevant memories and context from cloud storage before modifying a file.",
								inputSchema: {
									type: "object",
									properties: {
										path: {
											type: "string",
											description: "The ABSOLUTE path to the file being modified",
										},
										query: {
											type: "string",
											description: "What you're trying to do (helps find relevant memories)",
										},
									},
									required: ["path"],
								},
							},
						],
					},
					id,
				},
				{ headers: corsHeaders }
			);

		case "tools/call":
			// Handle tool calls
			const toolParams = params as { name?: string; arguments?: Record<string, unknown> } | undefined;
			const toolName = toolParams?.name;
			const toolArgs = toolParams?.arguments || {};

			if (toolName === "analyze_file" || toolName === "ask_history") {
				// These tools require git access - only available via local transport
				return NextResponse.json(
					{
						jsonrpc: "2.0",
						result: {
							content: [
								{
									type: "text",
									text: `## Cloud Endpoint Limitation\n\nThe \`${toolName}\` tool requires git repository access and is only available via the **local stdio transport**.\n\n### How to use full Memoria:\n\n1. Install locally: \`npm install -g @byronwade/memoria\`\n2. Configure your MCP client with stdio transport:\n\n\`\`\`json\n{\n  "mcpServers": {\n    "memoria": {\n      "command": "memoria"\n    }\n  }\n}\n\`\`\`\n\n### What this cloud endpoint provides:\n- OAuth authentication\n- Cloud memory/context storage (coming soon)\n- Team sharing features (coming soon)\n\nYou are authenticated successfully. Use the local transport for git-based analysis.`,
								},
							],
						},
						id,
					},
					{ headers: corsHeaders }
				);
			}

			if (toolName === "get_context") {
				// Cloud context tool - placeholder for future implementation
				return NextResponse.json(
					{
						jsonrpc: "2.0",
						result: {
							content: [
								{
									type: "text",
									text: `## Context for: ${toolArgs.path || "unknown"}\n\n**Status:** Cloud memory features coming soon.\n\n**Current capabilities:**\n- ✅ OAuth authentication working\n- 🚧 Memory storage (in development)\n- 🚧 Team sharing (in development)\n\nFor now, use the local stdio transport for full git-based analysis.`,
								},
							],
						},
						id,
					},
					{ headers: corsHeaders }
				);
			}

			return NextResponse.json(
				{
					jsonrpc: "2.0",
					error: {
						code: -32601,
						message: `Unknown tool: ${toolName}`,
					},
					id,
				},
				{ status: 400, headers: corsHeaders }
			);

		case "ping":
			return NextResponse.json(
				{
					jsonrpc: "2.0",
					result: {},
					id,
				},
				{ headers: corsHeaders }
			);

		default:
			return NextResponse.json(
				{
					jsonrpc: "2.0",
					error: {
						code: -32601,
						message: `Method not found: ${method}`,
					},
					id,
				},
				{ status: 400, headers: corsHeaders }
			);
	}
}
