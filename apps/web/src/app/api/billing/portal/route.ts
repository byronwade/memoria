import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callQuery } from "@/lib/convex";
import { createBillingPortalSession } from "@/lib/stripe/server";

interface UserBilling {
	_id: string;
	stripeCustomerId: string | null;
}

export async function POST(request: NextRequest) {
	try {
		const session = await getSession();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { returnUrl } = body;

		const userId = session.user._id;
		const convex = getConvexClient();

		// Get user billing status
		const user = await callQuery<UserBilling | null>(
			convex,
			"billing:getUserBillingStatus",
			{ userId }
		);

		if (!user) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		if (!user.stripeCustomerId) {
			return NextResponse.json(
				{ error: "No billing setup for this user" },
				{ status: 400 }
			);
		}

		// Create billing portal session
		const portalSession = await createBillingPortalSession({
			customerId: user.stripeCustomerId,
			returnUrl: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings`,
		});

		return NextResponse.json({ url: portalSession.url });
	} catch (error) {
		console.error("Failed to create billing portal session:", error);
		return NextResponse.json(
			{ error: "Failed to create billing portal session" },
			{ status: 500 }
		);
	}
}
