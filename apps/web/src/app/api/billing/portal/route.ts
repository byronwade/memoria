import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getConvexClient, callQuery } from "@/lib/convex";
import { createBillingPortalSession } from "@/lib/stripe/server";

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
		const { orgId, returnUrl } = body;

		if (!orgId) {
			return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
		}

		const convex = getConvexClient();

		// Get org
		const org = await callQuery<Organization | null>(
			convex,
			"orgs:getOrg",
			{ orgId }
		);

		if (!org) {
			return NextResponse.json({ error: "Organization not found" }, { status: 404 });
		}

		if (!org.stripeCustomerId) {
			return NextResponse.json(
				{ error: "No billing setup for this organization" },
				{ status: 400 }
			);
		}

		// Create billing portal session
		const portalSession = await createBillingPortalSession({
			customerId: org.stripeCustomerId,
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
