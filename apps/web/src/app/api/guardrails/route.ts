import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callMutation, callQuery } from "@/lib/convex";

interface GuardrailData {
	_id: string;
	pattern: string;
	level: "warn" | "block";
	message: string;
	isEnabled: boolean;
	repoId?: string;
	createdBy: string;
	creatorName: string;
	createdAt: number;
}

/**
 * GET /api/guardrails
 * List all guardrails for the current organization
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

		// Get guardrails for the organization
		const guardrails = await callQuery<GuardrailData[]>(
			convex,
			"guardrails:listGuardrails",
			{ orgId, includeDisabled: true }
		);

		return NextResponse.json({ guardrails: guardrails || [] });
	} catch (error) {
		console.error("Failed to fetch guardrails:", error);
		return NextResponse.json(
			{ error: "Failed to fetch guardrails" },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/guardrails
 * Create a new guardrail
 */
export async function POST(request: NextRequest) {
	try {
		const session = await getSession();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { pattern, level, message, repoId, isEnabled } = body;

		if (!pattern || typeof pattern !== "string" || !pattern.trim()) {
			return NextResponse.json(
				{ error: "Pattern is required" },
				{ status: 400 }
			);
		}

		if (!level || !["warn", "block"].includes(level)) {
			return NextResponse.json(
				{ error: "Level must be 'warn' or 'block'" },
				{ status: 400 }
			);
		}

		if (!message || typeof message !== "string" || !message.trim()) {
			return NextResponse.json(
				{ error: "Message is required" },
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

		// Create the guardrail
		const result = await callMutation<{ guardrailId: string }>(
			convex,
			"guardrails:createGuardrail",
			{
				orgId,
				pattern: pattern.trim(),
				level,
				message: message.trim(),
				repoId: repoId || undefined,
				isEnabled: isEnabled !== false,
				createdBy: session.user._id,
			}
		);

		return NextResponse.json({
			guardrailId: result.guardrailId,
		});
	} catch (error) {
		console.error("Failed to create guardrail:", error);
		return NextResponse.json(
			{ error: "Failed to create guardrail" },
			{ status: 500 }
		);
	}
}
