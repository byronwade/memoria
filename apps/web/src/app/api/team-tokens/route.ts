import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callMutation, callQuery } from "@/lib/convex";

interface TokenData {
	_id: string;
	name: string;
	createdAt: number;
	lastUsedAt: number | null;
	revokedAt: number | null;
	creatorName: string;
	maskedToken: string;
}

/**
 * GET /api/team-tokens
 * List all tokens for the current user
 */
export async function GET() {
	try {
		const session = await getSession();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const convex = getConvexClient();
		const userId = session.user._id;

		// Get tokens for the user
		const tokens = await callQuery<TokenData[]>(
			convex,
			"teamTokens:listTokens",
			{ userId }
		);

		return NextResponse.json({ tokens: tokens || [] });
	} catch (error) {
		console.error("Failed to fetch team tokens:", error);
		return NextResponse.json(
			{ error: "Failed to fetch team tokens" },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/team-tokens
 * Create a new team token
 */
export async function POST(request: NextRequest) {
	try {
		const session = await getSession();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { name } = body;

		if (!name || typeof name !== "string" || !name.trim()) {
			return NextResponse.json(
				{ error: "Token name is required" },
				{ status: 400 }
			);
		}

		const convex = getConvexClient();
		const userId = session.user._id;

		// Create the token
		const result = await callMutation<{ tokenId: string; token: string }>(
			convex,
			"teamTokens:createToken",
			{
				userId,
				name: name.trim(),
				createdBy: userId,
			}
		);

		return NextResponse.json({
			tokenId: result.tokenId,
			token: result.token,
		});
	} catch (error) {
		console.error("Failed to create team token:", error);
		return NextResponse.json(
			{ error: "Failed to create team token" },
			{ status: 500 }
		);
	}
}
