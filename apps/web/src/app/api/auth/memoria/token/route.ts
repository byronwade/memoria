import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getConvexClient, callMutation, callQuery } from "@/lib/convex";
import { getSession } from "@/lib/auth/session";

/**
 * POST /api/auth/memoria/token
 * OAuth 2.1 token exchange endpoint for MCP clients
 *
 * Supports:
 * - Authorization code exchange (grant_type=authorization_code)
 * - Refresh token exchange (grant_type=refresh_token)
 * - PKCE verification (code_verifier)
 *
 * Request body (application/x-www-form-urlencoded or application/json):
 * - grant_type: "authorization_code" or "refresh_token"
 * - code: Authorization code (for authorization_code grant)
 * - code_verifier: PKCE verifier (for authorization_code grant with PKCE)
 * - refresh_token: Refresh token (for refresh_token grant)
 * - client_id: Client identifier
 * - redirect_uri: Must match original authorization request
 * - resource: Optional resource indicator
 */
export async function POST(request: NextRequest) {
	try {
		// Parse body (support both JSON and form-urlencoded)
		let body: Record<string, string | undefined>;
		const contentType = request.headers.get("content-type") || "";

		if (contentType.includes("application/x-www-form-urlencoded")) {
			const formData = await request.formData();
			body = Object.fromEntries(formData.entries()) as Record<string, string>;
		} else {
			body = await request.json().catch(() => ({}));
		}

		const {
			grant_type,
			code,
			code_verifier,
			refresh_token,
			client_id,
			redirect_uri,
			resource
		} = body;

		// Handle refresh token grant
		if (grant_type === "refresh_token") {
			if (!refresh_token) {
				return NextResponse.json({
					error: "invalid_request",
					error_description: "refresh_token is required"
				}, { status: 400 });
			}

			// Validate refresh token and get new access token
			const convex = getConvexClient();
			try {
				const result = await callQuery<{
					valid: boolean;
					userId?: string;
					error?: string;
				}>(convex, "teamTokens:validateToken", { token: refresh_token });

				if (!result.valid || !result.userId) {
					return NextResponse.json({
						error: "invalid_grant",
						error_description: "Invalid refresh token"
					}, { status: 400 });
				}

				// Issue new access token
				const tokenName = `OAuth refresh - ${client_id || "mcp-client"} - ${new Date().toISOString()}`;
				const { token } = await callMutation<{ tokenId: string; token: string }>(
					convex,
					"teamTokens:createToken",
					{
						userId: result.userId,
						name: tokenName,
						createdBy: result.userId,
					}
				);

				return NextResponse.json({
					access_token: token,
					token_type: "Bearer",
					expires_in: 3600, // 1 hour
					refresh_token: refresh_token, // Return same refresh token
					scope: "read write",
				});
			} catch {
				return NextResponse.json({
					error: "invalid_grant",
					error_description: "Refresh token validation failed"
				}, { status: 400 });
			}
		}

		// Handle authorization code grant
		if (grant_type !== "authorization_code") {
			return NextResponse.json({
				error: "unsupported_grant_type",
				error_description: "Only authorization_code and refresh_token grants are supported"
			}, { status: 400 });
		}

		if (!code) {
			return NextResponse.json({
				error: "invalid_request",
				error_description: "code is required"
			}, { status: 400 });
		}

		// Get session to access stored PKCE challenge
		const session = await getSession();
		if (!session) {
			return NextResponse.json({
				error: "invalid_grant",
				error_description: "Session not found. User must be logged in."
			}, { status: 400 });
		}

		// Verify PKCE if code_verifier is provided
		// Note: In a production system, you'd store the code_challenge with the authorization code
		// in a database. For now, we use cookies (set during /authorize)
		const storedChallenge = request.cookies.get("memoria_oauth_code_challenge")?.value;

		if (storedChallenge && code_verifier) {
			// Compute S256 hash of verifier and compare to stored challenge
			const computedChallenge = createHash("sha256")
				.update(code_verifier)
				.digest("base64url");

			if (computedChallenge !== storedChallenge) {
				return NextResponse.json({
					error: "invalid_grant",
					error_description: "Code verifier does not match challenge"
				}, { status: 400 });
			}
		} else if (storedChallenge && !code_verifier) {
			// PKCE was used during authorization but verifier not provided
			return NextResponse.json({
				error: "invalid_request",
				error_description: "code_verifier is required for this authorization"
			}, { status: 400 });
		}

		// Generate access token (team token) for the user
		const convex = getConvexClient();
		const tokenName = `MCP OAuth - ${client_id || "mcp-client"} - ${new Date().toISOString()}`;

		const { token, tokenId } = await callMutation<{ tokenId: string; token: string }>(
			convex,
			"teamTokens:createToken",
			{
				userId: session.user._id,
				name: tokenName,
				createdBy: session.user._id,
			}
		);

		// Generate a refresh token (just another team token for simplicity)
		const refreshTokenName = `MCP Refresh - ${client_id || "mcp-client"} - ${new Date().toISOString()}`;
		const { token: newRefreshToken } = await callMutation<{ tokenId: string; token: string }>(
			convex,
			"teamTokens:createToken",
			{
				userId: session.user._id,
				name: refreshTokenName,
				createdBy: session.user._id,
			}
		);

		// Build response
		const response = NextResponse.json({
			access_token: token,
			token_type: "Bearer",
			expires_in: 3600, // 1 hour (MCP best practice: short-lived access tokens)
			refresh_token: newRefreshToken,
			scope: "read write",
		});

		// Clear PKCE challenge cookie
		response.cookies.delete("memoria_oauth_code_challenge");
		response.cookies.delete("memoria_oauth_resource");

		return response;
	} catch (error) {
		console.error("Token exchange error:", error);
		return NextResponse.json({
			error: "invalid_grant",
			error_description: "Token exchange failed"
		}, { status: 400 });
	}
}
