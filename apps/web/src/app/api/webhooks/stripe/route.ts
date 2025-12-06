import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { constructWebhookEvent } from "@/lib/stripe/server";
import { getConvexClient, callMutation, callQuery } from "@/lib/convex";

// Disable body parsing - we need the raw body for signature verification
export const runtime = "nodejs";

async function getRawBody(request: NextRequest): Promise<Buffer> {
	const reader = request.body?.getReader();
	if (!reader) {
		throw new Error("No request body");
	}

	const chunks: Uint8Array[] = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (value) chunks.push(value);
	}

	return Buffer.concat(chunks);
}

export async function POST(request: NextRequest) {
	try {
		const headersList = await headers();
		const signature = headersList.get("stripe-signature");

		if (!signature) {
			return NextResponse.json(
				{ error: "Missing stripe-signature header" },
				{ status: 400 }
			);
		}

		const rawBody = await getRawBody(request);
		let event: Stripe.Event;

		try {
			event = constructWebhookEvent(rawBody, signature);
		} catch (err) {
			console.error("Webhook signature verification failed:", err);
			return NextResponse.json(
				{ error: "Invalid signature" },
				{ status: 400 }
			);
		}

		const convex = getConvexClient();

		// Record the event for idempotency
		await callMutation(convex, "billing:recordBillingEvent", {
			stripeEventId: event.id,
			type: event.type,
			payload: event.data.object,
			processedAt: null,
		});

		// Handle specific event types
		switch (event.type) {
			case "checkout.session.completed": {
				const session = event.data.object as Stripe.Checkout.Session;
				await handleCheckoutCompleted(convex, session);
				break;
			}

			case "customer.subscription.created":
			case "customer.subscription.updated": {
				const subscription = event.data.object as Stripe.Subscription;
				await handleSubscriptionUpdated(convex, subscription);
				break;
			}

			case "customer.subscription.deleted": {
				const subscription = event.data.object as Stripe.Subscription;
				await handleSubscriptionDeleted(convex, subscription);
				break;
			}

			case "invoice.payment_succeeded": {
				const invoice = event.data.object as Stripe.Invoice;
				await handleInvoicePaymentSucceeded(convex, invoice);
				break;
			}

			case "invoice.payment_failed": {
				const invoice = event.data.object as Stripe.Invoice;
				await handleInvoicePaymentFailed(convex, invoice);
				break;
			}

			default:
				console.log(`Unhandled event type: ${event.type}`);
		}

		// Mark event as processed
		await callMutation(convex, "billing:recordBillingEvent", {
			stripeEventId: event.id,
			type: event.type,
			payload: event.data.object,
			processedAt: Date.now(),
		});

		return NextResponse.json({ received: true });
	} catch (error) {
		console.error("Webhook error:", error);
		return NextResponse.json(
			{ error: "Webhook handler failed" },
			{ status: 500 }
		);
	}
}

async function handleCheckoutCompleted(
	convex: ReturnType<typeof getConvexClient>,
	session: Stripe.Checkout.Session
) {
	const userId = session.metadata?.userId;
	const planId = session.metadata?.planId;

	if (!userId || !planId) {
		console.error("Missing userId or planId in checkout session metadata");
		return;
	}

	// The subscription will be created via the subscription.created webhook
	// Just log for now
	console.log(`Checkout completed for user ${userId}, plan ${planId}`);
}

async function handleSubscriptionUpdated(
	convex: ReturnType<typeof getConvexClient>,
	subscription: Stripe.Subscription
) {
	const customerId = subscription.customer as string;

	// Find user by Stripe customer ID
	const user = await callQuery<{ _id: string } | null>(
		convex,
		"billing:getUserByStripeCustomerId",
		{ stripeCustomerId: customerId }
	);

	if (!user) {
		console.error(`No user found for Stripe customer ${customerId}`);
		return;
	}

	const userId = user._id;

	// Get plan from metadata or price
	const priceId = subscription.items.data[0]?.price?.id;
	const plan = await callQuery<{ _id: string; maxRepos: number | null; maxAnalysesPerMonth: number | null } | null>(
		convex,
		"billing:getPlanByStripePrice",
		{ stripePriceId: priceId }
	);

	if (!plan) {
		console.error(`No plan found for price ${priceId}`);
		return;
	}

	// Map Stripe status to our status
	const statusMap: Record<string, "active" | "trial" | "past_due" | "canceled"> = {
		active: "active",
		trialing: "trial",
		past_due: "past_due",
		canceled: "canceled",
		incomplete: "past_due",
		incomplete_expired: "canceled",
		unpaid: "past_due",
		paused: "canceled",
	};

	const status = statusMap[subscription.status] || "active";

	// Update user billing status
	await callMutation(convex, "billing:updateUserBilling", {
		userId,
		stripeSubscriptionId: subscription.id,
		planTier: plan._id.includes("pro") ? "pro" : plan._id.includes("team") ? "team" : "free",
		subscriptionStatus: status,
		trialEndsAt: subscription.trial_end ? subscription.trial_end * 1000 : undefined,
		maxRepos: plan.maxRepos ?? undefined,
	});
}

async function handleSubscriptionDeleted(
	convex: ReturnType<typeof getConvexClient>,
	subscription: Stripe.Subscription
) {
	const customerId = subscription.customer as string;

	const user = await callQuery<{ _id: string } | null>(
		convex,
		"billing:getUserByStripeCustomerId",
		{ stripeCustomerId: customerId }
	);

	if (!user) return;

	// Downgrade to free plan
	await callMutation(convex, "billing:updateUserBilling", {
		userId: user._id,
		planTier: "free",
		subscriptionStatus: "canceled",
		stripeSubscriptionId: undefined,
		maxRepos: 1,
	});
}

async function handleInvoicePaymentSucceeded(
	convex: ReturnType<typeof getConvexClient>,
	invoice: Stripe.Invoice
) {
	// Log successful payment
	console.log(`Invoice payment succeeded: ${invoice.id}`);
}

async function handleInvoicePaymentFailed(
	convex: ReturnType<typeof getConvexClient>,
	invoice: Stripe.Invoice
) {
	const customerId = invoice.customer as string;

	const user = await callQuery<{ _id: string } | null>(
		convex,
		"billing:getUserByStripeCustomerId",
		{ stripeCustomerId: customerId }
	);

	if (!user) return;

	// Update user status to past_due
	await callMutation(convex, "billing:updateUserBilling", {
		userId: user._id,
		subscriptionStatus: "past_due",
	});

	console.log(`Invoice payment failed for user ${user._id}`);
}
