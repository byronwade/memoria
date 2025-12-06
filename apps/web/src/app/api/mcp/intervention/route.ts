import { NextRequest, NextResponse } from "next/server";
import { getConvexClient, callQuery, callMutation } from "@/lib/convex";

interface TokenValidation {
	valid: boolean;
	error?: string;
	userId?: string;
	tokenId?: string;
}

interface Repository {
	_id: string;
	fullName: string;
}

interface InterventionRequest {
	repoFullName: string;
	filePath: string;
	action: "blocked" | "warned";
	guardrailId?: string;
	aiTool: string;
	aiModel?: string;
	context?: string;
}

/**
 * POST /api/mcp/intervention
 * Records when the MCP server blocks or warns on a file modification
 *
 * Headers:
 *   Authorization: Bearer mem_xxxxx
 *
 * Body:
 *   {
 *     repoFullName: "owner/repo",
 *     filePath: "src/auth/login.ts",
 *     action: "blocked" | "warned",
 *     guardrailId?: "id_of_guardrail",
 *     aiTool: "cursor" | "claude-code" | "windsurf" | etc,
 *     aiModel?: "claude-3.5-sonnet",
 *     context?: "Attempting to modify authentication logic"
 *   }
 */
export async function POST(request: NextRequest) {
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

		// Parse request body
		const body = (await request.json()) as InterventionRequest;

		// Validate required fields
		if (!body.repoFullName || !body.filePath || !body.action || !body.aiTool) {
			return NextResponse.json(
				{
					error: "Missing required fields: repoFullName, filePath, action, aiTool",
				},
				{ status: 400 }
			);
		}

		// Validate action
		if (!["blocked", "warned"].includes(body.action)) {
			return NextResponse.json(
				{ error: "Invalid action: must be 'blocked' or 'warned'" },
				{ status: 400 }
			);
		}

		// Look up the repository by full name
		const repos = await callQuery<Repository[]>(
			convex,
			"scm:getRepositories",
			{ userId: validation.userId }
		);
		const repo = repos.find((r) => r.fullName === body.repoFullName);

		if (!repo) {
			return NextResponse.json(
				{ error: `Repository not found: ${body.repoFullName}` },
				{ status: 404 }
			);
		}

		// Record the intervention
		const result = await callMutation<{ interventionId: string }>(
			convex,
			"interventions:recordIntervention",
			{
				userId: validation.userId,
				repoId: repo._id,
				guardrailId: body.guardrailId || undefined,
				filePath: body.filePath,
				action: body.action,
				aiTool: body.aiTool,
				aiModel: body.aiModel,
				context: body.context,
			}
		);

		return NextResponse.json({
			success: true,
			interventionId: result.interventionId,
			message: `Intervention recorded: ${body.action} on ${body.filePath}`,
		});
	} catch (error) {
		console.error("MCP intervention recording error:", error);
		return NextResponse.json(
			{ error: "Failed to record intervention" },
			{ status: 500 }
		);
	}
}
