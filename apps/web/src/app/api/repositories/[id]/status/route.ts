import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callMutation, callQuery } from "@/lib/convex";

/**
 * PATCH /api/repositories/[id]/status
 * Update repository active status (activate/deactivate)
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

		const { id: repoId } = await params;
		const body = await request.json();
		const { isActive } = body;

		if (typeof isActive !== "boolean") {
			return NextResponse.json(
				{ error: "isActive must be a boolean" },
				{ status: 400 }
			);
		}

		const convex = getConvexClient();

		// Verify the repository belongs to the user's organization
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

		// Get the repository to verify ownership
		const repos = await callQuery<Array<{ _id: string; orgId: string }>>(
			convex,
			"scm:getRepositories",
			{ orgId }
		);

		const repo = repos?.find(r => r._id === repoId);
		if (!repo) {
			return NextResponse.json(
				{ error: "Repository not found or not authorized" },
				{ status: 404 }
			);
		}

		// Update the repository status
		await callMutation(convex, "scm:setRepositoryActive", {
			repoId,
			isActive,
		});

		return NextResponse.json({ success: true, isActive });
	} catch (error) {
		console.error("Failed to update repository status:", error);
		return NextResponse.json(
			{ error: "Failed to update repository status" },
			{ status: 500 }
		);
	}
}
