import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callMutation, callQuery } from "@/lib/convex";

interface MemoryData {
	_id: string;
	context: string;
	tags: string[];
	linkedFiles: string[];
	repoId?: string;
	createdBy: string;
	creatorName: string;
	createdAt: number;
}

/**
 * GET /api/memories
 * List all memories for the current organization
 */
export async function GET() {
	try {
		const session = await getSession();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const convex = getConvexClient();

		// Get user's organization
		const orgs = await callQuery<Array<{ _id: string }>>(
			convex,
			"orgs:getUserOrganizations",
			{ userId: session.user._id }
		);

		if (!orgs || orgs.length === 0) {
			return NextResponse.json(
				{ error: "No organization found" },
				{ status: 404 }
			);
		}

		const orgId = orgs[0]._id;

		// Get memories for the organization
		const memories = await callQuery<MemoryData[]>(
			convex,
			"memories:listMemories",
			{ orgId }
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
 * POST /api/memories
 * Create a new memory
 */
export async function POST(request: NextRequest) {
	try {
		const session = await getSession();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { context, tags, linkedFiles, repoId } = body;

		if (!context || typeof context !== "string" || !context.trim()) {
			return NextResponse.json(
				{ error: "Context is required" },
				{ status: 400 }
			);
		}

		const convex = getConvexClient();

		// Get user's organization
		const orgs = await callQuery<Array<{ _id: string }>>(
			convex,
			"orgs:getUserOrganizations",
			{ userId: session.user._id }
		);

		if (!orgs || orgs.length === 0) {
			return NextResponse.json(
				{ error: "No organization found" },
				{ status: 404 }
			);
		}

		const orgId = orgs[0]._id;

		// Create the memory
		const result = await callMutation<{ memoryId: string }>(
			convex,
			"memories:createMemory",
			{
				orgId,
				context: context.trim(),
				tags: Array.isArray(tags) ? tags : [],
				linkedFiles: Array.isArray(linkedFiles) ? linkedFiles : [],
				repoId: repoId || undefined,
				createdBy: session.user._id,
			}
		);

		return NextResponse.json({
			memoryId: result.memoryId,
		});
	} catch (error) {
		console.error("Failed to create memory:", error);
		return NextResponse.json(
			{ error: "Failed to create memory" },
			{ status: 500 }
		);
	}
}
