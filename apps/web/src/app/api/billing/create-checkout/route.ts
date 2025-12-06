import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callQuery, callMutation } from "@/lib/convex";
import { stripe, createCustomer, createCheckoutSession } from "@/lib/stripe/server";

interface BillingPlan {
	_id: string;
	name: string;
	tier: string;
	stripePriceId: string | null;
	maxRepos: number | null;
	maxAnalysesPerMonth: number | null;
	pricePerMonthUsd: number;
}

interface Organization {
	_id: string;
	name: string;
	stripeCustomerId: string | null;
}

export async function POST(request: NextRequest) {
	try {
		const session = await getSession();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { orgId, planTier, successUrl, cancelUrl } = body;

		if (!orgId || !planTier) {
			return NextResponse.json(
				{ error: "Missing orgId or planTier" },
				{ status: 400 }
			);
		}

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

		// Get org
		const org = await callQuery<Organization | null>(
			convex,
			"orgs:getOrg",
			{ orgId }
		);

		if (!org) {
			return NextResponse.json({ error: "Organization not found" }, { status: 404 });
		}

		// Create or get Stripe customer
		let stripeCustomerId = org.stripeCustomerId;

		if (!stripeCustomerId) {
			const customer = await createCustomer({
				email: session.user.email,
				name: org.name,
				metadata: {
					orgId: org._id,
					userId: session.user._id,
				},
			});
			stripeCustomerId = customer.id;

			// Update org with Stripe customer ID
			await callMutation(convex, "billing:updateOrgBillingStatus", {
				orgId,
				stripeCustomerId,
			});

			// Also create billing customer record
			await callMutation(convex, "billing:upsertBillingCustomer", {
				orgId,
				stripeCustomerId,
				defaultPaymentMethodId: null,
				metadata: { userId: session.user._id },
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
				orgId: org._id,
				planId: plan._id,
				userId: session.user._id,
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
