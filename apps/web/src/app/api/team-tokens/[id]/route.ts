import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callMutation, callQuery } from "@/lib/convex";

interface TokenRecord {
	_id: string;
	userId: string;
}

/**
 * DELETE /api/team-tokens/[id]
 * Revoke a team token
 */
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await getSession();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id: tokenId } = await params;

		const convex = getConvexClient();
		const userId = session.user._id;

		// Get the token to verify ownership
		const tokens = await callQuery<TokenRecord[]>(
			convex,
			"teamTokens:listTokens",
			{ userId, includeRevoked: false }
		);

		const token = tokens?.find(t => t._id === tokenId);
		if (!token) {
			return NextResponse.json(
				{ error: "Token not found or not authorized" },
				{ status: 404 }
			);
		}

		// Revoke the token
		await callMutation(convex, "teamTokens:revokeToken", { tokenId });

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to revoke team token:", error);
		return NextResponse.json(
			{ error: "Failed to revoke team token" },
			{ status: 500 }
		);
	}
}
