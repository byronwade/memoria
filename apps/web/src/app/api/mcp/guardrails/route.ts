import { NextRequest, NextResponse } from "next/server";
import { getConvexClient, callQuery } from "@/lib/convex";

interface GuardrailData {
	_id: string;
	pattern: string;
	level: "warn" | "block";
	message: string;
	isEnabled: boolean;
	repoId?: string;
}

/**
 * Validate token from Authorization header
 */
async function validateToken(
	request: NextRequest
): Promise<{ valid: boolean; userId?: string; error?: string }> {
	const authHeader = request.headers.get("Authorization");
	const token = authHeader?.replace("Bearer ", "");

	if (!token) {
		return { valid: false, error: "Authorization token required" };
	}

	const convex = getConvexClient();
	const result = await callQuery<{
		valid: boolean;
		userId?: string;
		error?: string;
	}>(convex, "teamTokens:validateToken", { token });

	return result;
}

/**
 * GET /api/mcp/guardrails
 * Get guardrails that apply to a file path
 */
export async function GET(request: NextRequest) {
	try {
		const auth = await validateToken(request);
		if (!auth.valid) {
			return NextResponse.json(
				{ error: auth.error || "Unauthorized" },
				{ status: 401 }
			);
		}

		const { searchParams } = new URL(request.url);
		const filePath = searchParams.get("filePath");
		const repoId = searchParams.get("repoId") || undefined;

		const convex = getConvexClient();

		// Get all enabled guardrails for the user
		const allGuardrails = await callQuery<GuardrailData[]>(
			convex,
			"guardrails:listGuardrails",
			{
				userId: auth.userId!,
				includeDisabled: false,
			}
		);

		// Filter to applicable guardrails (user-wide or matching repo)
		let applicableGuardrails = allGuardrails.filter(
			(g) => !g.repoId || g.repoId === repoId
		);

		// If filePath provided, filter to matching patterns
		if (filePath) {
			applicableGuardrails = applicableGuardrails.filter((g) => {
				try {
					const regex = globToRegex(g.pattern);
					return regex.test(filePath);
				} catch {
					return false;
				}
			});
		}

		return NextResponse.json({
			guardrails: applicableGuardrails,
		});
	} catch (error) {
		console.error("Failed to fetch guardrails:", error);
		return NextResponse.json(
			{ error: "Failed to fetch guardrails" },
			{ status: 500 }
		);
	}
}

/**
 * Convert a glob pattern to a regex
 */
function globToRegex(glob: string): RegExp {
	const escaped = glob
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*\*/g, ".*")
		.replace(/\*/g, "[^/]*")
		.replace(/\?/g, ".");

	return new RegExp(`^${escaped}$`);
}
