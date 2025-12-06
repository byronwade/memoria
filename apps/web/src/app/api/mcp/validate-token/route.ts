import { NextRequest, NextResponse } from "next/server";
import { getConvexClient, callQuery, callMutation } from "@/lib/convex";

/**
 * POST /api/mcp/validate-token
 * Validates a team token and returns user info
 * Used by MCP servers to authenticate
 */
export async function POST(request: NextRequest) {
	try {
		// Get token from Authorization header or body
		const authHeader = request.headers.get("Authorization");
		const body = await request.json().catch(() => ({}));

		const token = authHeader?.replace("Bearer ", "") || body.token;

		if (!token) {
			return NextResponse.json(
				{ valid: false, error: "Token is required" },
				{ status: 400 }
			);
		}

		const convex = getConvexClient();

		// Validate the token
		const result = await callQuery<{
			valid: boolean;
			userId?: string;
			userName?: string;
			userEmail?: string;
			tokenId?: string;
			error?: string;
		}>(convex, "teamTokens:validateToken", { token });

		if (!result.valid) {
			return NextResponse.json(
				{ valid: false, error: result.error || "Invalid token" },
				{ status: 401 }
			);
		}

		// Update last used timestamp
		if (result.tokenId) {
			await callMutation(convex, "teamTokens:updateTokenLastUsed", {
				tokenId: result.tokenId,
			}).catch(() => {
				// Non-critical, don't fail the request
			});
		}

		return NextResponse.json({
			valid: true,
			userId: result.userId,
			userName: result.userName,
			userEmail: result.userEmail,
		});
	} catch (error) {
		console.error("Token validation error:", error);
		return NextResponse.json(
			{ valid: false, error: "Internal server error" },
			{ status: 500 }
		);
	}
}
