import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callMutation, callQuery } from "@/lib/convex";

interface GuardrailRecord {
	_id: string;
	orgId: string;
}

/**
 * PATCH /api/guardrails/[id]
 * Update a guardrail
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

		const { id: guardrailId } = await params;
		const body = await request.json();
		const { pattern, level, message, repoId, isEnabled } = body;

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

		// Get the guardrail to verify ownership
		const guardrails = await callQuery<GuardrailRecord[]>(
			convex,
			"guardrails:listGuardrails",
			{ orgId, includeDisabled: true }
		);

		const guardrail = guardrails?.find((g) => g._id === guardrailId);
		if (!guardrail) {
			return NextResponse.json(
				{ error: "Guardrail not found or not authorized" },
				{ status: 404 }
			);
		}

		// Build update object with only provided fields
		const updates: Record<string, unknown> = {};
		if (pattern !== undefined) updates.pattern = pattern.trim();
		if (level !== undefined) updates.level = level;
		if (message !== undefined) updates.message = message.trim();
		if (repoId !== undefined) updates.repoId = repoId || undefined;
		if (isEnabled !== undefined) updates.isEnabled = isEnabled;

		// Update the guardrail
		await callMutation(convex, "guardrails:updateGuardrail", {
			guardrailId,
			...updates,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to update guardrail:", error);
		return NextResponse.json(
			{ error: "Failed to update guardrail" },
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/guardrails/[id]
 * Delete a guardrail
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

		const { id: guardrailId } = await params;

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

		// Get the guardrail to verify ownership
		const guardrails = await callQuery<GuardrailRecord[]>(
			convex,
			"guardrails:listGuardrails",
			{ orgId, includeDisabled: true }
		);

		const guardrail = guardrails?.find((g) => g._id === guardrailId);
		if (!guardrail) {
			return NextResponse.json(
				{ error: "Guardrail not found or not authorized" },
				{ status: 404 }
			);
		}

		// Delete the guardrail
		await callMutation(convex, "guardrails:deleteGuardrail", { guardrailId });

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to delete guardrail:", error);
		return NextResponse.json(
			{ error: "Failed to delete guardrail" },
			{ status: 500 }
		);
	}
}
