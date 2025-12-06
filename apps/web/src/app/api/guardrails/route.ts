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
 * List all guardrails for the current user
 */
export async function GET() {
	try {
		const session = await getSession();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const convex = getConvexClient();
		const userId = session.user._id;

		// Get guardrails for the user
		const guardrails = await callQuery<GuardrailData[]>(
			convex,
			"guardrails:listGuardrails",
			{ userId, includeDisabled: true }
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
		const { pattern, level, message, repoId } = body;

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
		const userId = session.user._id;

		// Create the guardrail
		const result = await callMutation<{ guardrailId: string }>(
			convex,
			"guardrails:createGuardrail",
			{
				userId,
				pattern: pattern.trim(),
				level,
				message: message.trim(),
				repoId: repoId || undefined,
				createdBy: userId,
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
