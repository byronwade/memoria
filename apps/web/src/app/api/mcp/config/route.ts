import { NextRequest, NextResponse } from "next/server";
import { getConvexClient, callQuery, callMutation } from "@/lib/convex";

interface TokenValidation {
	valid: boolean;
	error?: string;
	userId?: string;
	userName?: string;
	userEmail?: string;
	tokenId?: string;
}

interface Guardrail {
	_id: string;
	pattern: string;
	level: "warn" | "block";
	message: string;
	repoId?: string;
}

interface Memory {
	_id: string;
	context: string;
	tags: string[];
	linkedFiles: string[];
	repoId?: string;
}

interface Repository {
	_id: string;
	fullName: string;
	providerRepoId: string;
}

/**
 * GET /api/mcp/config
 * Returns all guardrails and memories for the authenticated user
 * Used by MCP server to fetch team configuration
 *
 * Headers:
 *   Authorization: Bearer mem_xxxxx
 *
 * Query params:
 *   repoFullName (optional): Filter to specific repository
 */
export async function GET(request: NextRequest) {
	// Extract token from Authorization header
	const authHeader = request.headers.get("Authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return NextResponse.json(
			{ error: "Missing or invalid Authorization header" },
			{ status: 401 }
		);
	}

	const token = authHeader.slice(7); // Remove "Bearer " prefix

	try {
		const convex = getConvexClient();

		// Validate token
		const validation = await callQuery<TokenValidation>(
			convex,
			"teamTokens:validateToken",
			{ token }
		);

		if (!validation.valid || !validation.userId) {
			return NextResponse.json(
				{ error: validation.error || "Invalid token" },
				{ status: 401 }
			);
		}

		// Update token last used
		if (validation.tokenId) {
			await callMutation(convex, "teamTokens:updateTokenLastUsed", {
				tokenId: validation.tokenId,
			});
		}

		// Get optional repo filter
		const repoFullName = request.nextUrl.searchParams.get("repoFullName");

		// Fetch guardrails for this user
		let guardrails = await callQuery<Guardrail[]>(
			convex,
			"guardrails:listGuardrails",
			{ userId: validation.userId }
		);

		// Fetch memories for this user
		let memories = await callQuery<Memory[]>(
			convex,
			"memories:listMemories",
			{ userId: validation.userId }
		);

		// If repo filter is specified, find the repo and filter results
		let repoId: string | undefined;
		if (repoFullName) {
			// Look up repo by full name
			const repos = await callQuery<Repository[]>(
				convex,
				"scm:getRepositories",
				{ userId: validation.userId }
			);
			const repo = repos.find((r) => r.fullName === repoFullName);

			if (repo) {
				repoId = repo._id;

				// Filter to user-wide + this repo's guardrails/memories
				guardrails = guardrails.filter(
					(g) => g.repoId === undefined || g.repoId === repoId
				);
				memories = memories.filter(
					(m) => m.repoId === undefined || m.repoId === repoId
				);
			}
		}

		// Format response for MCP consumption
		const config = {
			user: {
				id: validation.userId,
				name: validation.userName,
				email: validation.userEmail,
			},
			guardrails: guardrails.map((g) => ({
				id: g._id,
				pattern: g.pattern,
				level: g.level,
				message: g.message,
				scope: g.repoId ? "repo" : "user",
			})),
			memories: memories.map((m) => ({
				id: m._id,
				context: m.context,
				tags: m.tags,
				linkedFiles: m.linkedFiles,
				scope: m.repoId ? "repo" : "user",
			})),
			fetchedAt: new Date().toISOString(),
		};

		return NextResponse.json(config);
	} catch (error) {
		console.error("MCP config fetch error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch configuration" },
			{ status: 500 }
		);
	}
}
