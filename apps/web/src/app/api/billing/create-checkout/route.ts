import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callQuery, callMutation } from "@/lib/convex";
import { createCustomer, createCheckoutSession } from "@/lib/stripe/server";

interface BillingPlan {
	_id: string;
	name: string;
	tier: string;
	stripePriceId: string | null;
	maxRepos: number | null;
	maxAnalysesPerMonth: number | null;
	pricePerMonthUsd: number;
}

interface UserData {
	_id: string;
	name: string | null;
	email: string;
	stripeCustomerId: string | null;
}

export async function POST(request: NextRequest) {
	try {
		const session = await getSession();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { planTier, successUrl, cancelUrl } = body;

		if (!planTier) {
			return NextResponse.json(
				{ error: "Missing planTier" },
				{ status: 400 }
			);
		}

		const userId = session.user._id;
		const convex = getConvexClient();

		// Get the plan
		const plan = await callQuery<BillingPlan | null>(
			convex,
			"billing:getPlanByTier",
			{ tier: planTier }
		);

		if (!plan || !plan.stripePriceId) {
			return NextResponse.json(
				{ error: "Invalid plan or plan not configured for billing" },
				{ status: 400 }
			);
		}

		// Get user billing info
		const user = await callQuery<UserData | null>(
			convex,
			"billing:getUserBillingStatus",
			{ userId }
		);

		if (!user) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		// Create or get Stripe customer
		let stripeCustomerId = user.stripeCustomerId;

		if (!stripeCustomerId) {
			const customer = await createCustomer({
				email: session.user.email,
				name: user.name || session.user.email,
				metadata: {
					userId,
				},
			});
			stripeCustomerId = customer.id;

			// Update user with Stripe customer ID
			await callMutation(convex, "billing:updateUserBilling", {
				userId,
				stripeCustomerId,
			});
		}

		// Create checkout session
		const checkoutSession = await createCheckoutSession({
			customerId: stripeCustomerId,
			priceId: plan.stripePriceId,
			successUrl: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
			cancelUrl: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/onboarding`,
			trialDays: 14, // 14-day trial
			metadata: {
				planId: plan._id,
				userId,
			},
		});

		return NextResponse.json({ url: checkoutSession.url });
	} catch (error) {
		console.error("Failed to create checkout session:", error);
		return NextResponse.json(
			{ error: "Failed to create checkout session" },
			{ status: 500 }
		);
	}
}
