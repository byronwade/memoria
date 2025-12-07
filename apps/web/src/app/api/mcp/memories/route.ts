import { NextRequest, NextResponse } from "next/server";
import { getConvexClient, callQuery, callMutation } from "@/lib/convex";

interface MemoryData {
	_id: string;
	context: string;
	summary?: string;
	tags: string[];
	keywords?: string[];
	linkedFiles: string[];
	memoryType?: string;
	importance?: string;
	createdAt: number;
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
 * GET /api/mcp/memories
 * Get memories for a file path (with keyword search)
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
		const keywordsParam = searchParams.get("keywords");
		const keywords = keywordsParam ? keywordsParam.split(",") : [];

		const convex = getConvexClient();

		if (filePath) {
			// Get memories for a specific file
			const memories = await callQuery<MemoryData[]>(
				convex,
				"memories:getMemoriesForFile",
				{
					userId: auth.userId!,
					repoId,
					filePath,
				}
			);
			return NextResponse.json({ memories: memories || [] });
		}

		if (keywords.length > 0) {
			// Search memories by keywords
			const memories = await callQuery<MemoryData[]>(
				convex,
				"memories:searchMemories",
				{
					userId: auth.userId!,
					repoId,
					queryKeywords: keywords,
					limit: 20,
				}
			);
			return NextResponse.json({ memories: memories || [] });
		}

		// Get critical/high importance memories
		const memories = await callQuery<MemoryData[]>(
			convex,
			"memories:getCriticalMemories",
			{
				userId: auth.userId!,
				repoId,
			}
		);
		return NextResponse.json({ memories: memories || [] });
	} catch (error) {
		console.error("Failed to fetch memories:", error);
		return NextResponse.json(
			{ error: "Failed to fetch memories" },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/mcp/memories
 * Create a new memory (from MCP server)
 */
export async function POST(request: NextRequest) {
	try {
		const auth = await validateToken(request);
		if (!auth.valid) {
			return NextResponse.json(
				{ error: auth.error || "Unauthorized" },
				{ status: 401 }
			);
		}

		const body = await request.json();
		const {
			context,
			summary,
			tags,
			keywords,
			linkedFiles,
			memoryType,
			importance,
			repoId,
		} = body;

		if (!context || typeof context !== "string" || !context.trim()) {
			return NextResponse.json(
				{ error: "Context is required" },
				{ status: 400 }
			);
		}

		const convex = getConvexClient();

		const result = await callMutation<{ memoryId: string }>(
			convex,
			"memories:createMemory",
			{
				userId: auth.userId!,
				scope: repoId ? "repository" : "global",
				repoId: repoId || undefined,
				context: context.trim(),
				summary: summary || undefined,
				tags: Array.isArray(tags) ? tags : [],
				keywords: Array.isArray(keywords) ? keywords : undefined,
				linkedFiles: Array.isArray(linkedFiles) ? linkedFiles : [],
				memoryType: memoryType || "lesson",
				importance: importance || "normal",
				source: {
					type: "auto_extracted",
					reference: null,
				},
				createdBy: auth.userId!,
			}
		);

		return NextResponse.json({
			memoryId: result.memoryId,
			success: true,
		});
	} catch (error) {
		console.error("Failed to create memory:", error);
		return NextResponse.json(
			{ error: "Failed to create memory" },
			{ status: 500 }
		);
	}
}
