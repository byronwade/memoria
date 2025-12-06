import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callMutation, callQuery } from "@/lib/convex";

interface MemoryRecord {
	_id: string;
	userId: string;
}

/**
 * PATCH /api/memories/[id]
 * Update a memory
 */
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await getSession();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id: memoryId } = await params;
		const body = await request.json();
		const { context, tags, linkedFiles, repoId } = body;

		const convex = getConvexClient();
		const userId = session.user._id;

		// Get the memory to verify ownership
		const memories = await callQuery<MemoryRecord[]>(
			convex,
			"memories:listMemories",
			{ userId }
		);

		const memory = memories?.find((m) => m._id === memoryId);
		if (!memory) {
			return NextResponse.json(
				{ error: "Memory not found or not authorized" },
				{ status: 404 }
			);
		}

		// Build update object with only provided fields
		const updates: Record<string, unknown> = {};
		if (context !== undefined) updates.context = context.trim();
		if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags : [];
		if (linkedFiles !== undefined) updates.linkedFiles = Array.isArray(linkedFiles) ? linkedFiles : [];
		if (repoId !== undefined) updates.repoId = repoId || undefined;

		// Update the memory
		await callMutation(convex, "memories:updateMemory", {
			memoryId,
			...updates,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to update memory:", error);
		return NextResponse.json(
			{ error: "Failed to update memory" },
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/memories/[id]
 * Delete a memory
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

		const { id: memoryId } = await params;

		const convex = getConvexClient();
		const userId = session.user._id;

		// Get the memory to verify ownership
		const memories = await callQuery<MemoryRecord[]>(
			convex,
			"memories:listMemories",
			{ userId }
		);

		const memory = memories?.find((m) => m._id === memoryId);
		if (!memory) {
			return NextResponse.json(
				{ error: "Memory not found or not authorized" },
				{ status: 404 }
			);
		}

		// Delete the memory
		await callMutation(convex, "memories:deleteMemory", { memoryId });

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to delete memory:", error);
		return NextResponse.json(
			{ error: "Failed to delete memory" },
			{ status: 500 }
		);
	}
}
