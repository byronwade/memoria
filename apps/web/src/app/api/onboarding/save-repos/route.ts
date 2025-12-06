import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callMutation, callQuery } from "@/lib/convex";

export async function POST(request: NextRequest) {
	try {
		const session = await getSession();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { orgId, repoIds } = body;

		if (!orgId || !Array.isArray(repoIds)) {
			return NextResponse.json(
				{ error: "Missing orgId or repoIds" },
				{ status: 400 }
			);
		}

		const convex = getConvexClient();

		// Get all repos for this org
		const allRepos = await callQuery<Array<{ _id: string; isActive: boolean }>>(
			convex,
			"scm:getRepositories",
			{ orgId }
		);

		// Update each repo's active status
		for (const repo of allRepos) {
			const shouldBeActive = repoIds.includes(repo._id);
			if (repo.isActive !== shouldBeActive) {
				await callMutation(convex, "scm:setRepositoryActive", {
					repoId: repo._id,
					isActive: shouldBeActive,
				});
			}
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to save repos:", error);
		return NextResponse.json(
			{ error: "Failed to save repositories" },
			{ status: 500 }
		);
	}
}
