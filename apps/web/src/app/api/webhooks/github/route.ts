import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getConvexClient, callMutation, callAction } from "@/lib/convex";

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

/**
 * Verify GitHub webhook signature using HMAC SHA-256
 */
function verifySignature(payload: string, signature: string | null): boolean {
	if (!WEBHOOK_SECRET || !signature) {
		return false;
	}

	const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
	const digest = `sha256=${hmac.update(payload).digest("hex")}`;

	try {
		return crypto.timingSafeEqual(
			Buffer.from(digest),
			Buffer.from(signature)
		);
	} catch {
		return false;
	}
}

/**
 * POST /api/webhooks/github
 * Receives GitHub webhooks, verifies signature, stores payload, triggers processing
 */
export async function POST(request: NextRequest) {
	// Get headers
	const signature = request.headers.get("x-hub-signature-256");
	const eventType = request.headers.get("x-github-event") || "unknown";
	const deliveryId = request.headers.get("x-github-delivery") || `unknown-${Date.now()}`;

	// Get raw body for signature verification
	const rawBody = await request.text();

	// Verify webhook signature (skip in development if no secret configured)
	if (WEBHOOK_SECRET && !verifySignature(rawBody, signature)) {
		console.error("Invalid webhook signature");
		return NextResponse.json(
			{ error: "Invalid signature" },
			{ status: 401 }
		);
	}

	// Parse payload
	let payload: unknown;
	try {
		payload = JSON.parse(rawBody);
	} catch {
		return NextResponse.json(
			{ error: "Invalid JSON payload" },
			{ status: 400 }
		);
	}

	try {
		const convex = getConvexClient();

		// Store webhook payload in database
		const { webhookId } = await callMutation<{ webhookId: string }>(
			convex,
			"webhooks:storeInboundWebhook",
			{
				source: "github",
				externalEventId: deliveryId,
				eventType,
				payload,
			}
		);

		// Log for debugging
		console.log(`GitHub webhook received: ${eventType} (${deliveryId})`);

		// Trigger async processing via Convex action
		try {
			await callAction(convex, "github:processWebhook", { webhookId });
			console.log(`Webhook processing triggered for ${eventType} (${deliveryId})`);
		} catch (actionError) {
			// Log the error but don't fail the webhook - it's stored for retry
			console.error("Webhook processing failed:", actionError);
		}

		// Return 202 Accepted to indicate async processing
		return NextResponse.json(
			{
				status: "accepted",
				webhookId,
				eventType,
				deliveryId,
			},
			{ status: 202 }
		);
	} catch (error) {
		console.error("Webhook processing error:", error);
		return NextResponse.json(
			{ error: "Processing failed" },
			{ status: 500 }
		);
	}
}

/**
 * Handle ping events from GitHub (sent when webhook is first configured)
 */
export async function GET() {
	return NextResponse.json({
		status: "ok",
		message: "GitHub webhook endpoint is ready",
	});
}
