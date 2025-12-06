import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripeInstance(): Stripe {
	if (!_stripe) {
		if (!process.env.STRIPE_SECRET_KEY) {
			throw new Error("STRIPE_SECRET_KEY is not configured");
		}
		_stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
			apiVersion: "2024-06-20",
			typescript: true,
		});
	}
	return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
	get: (_, prop) => {
		const instance = getStripeInstance();
		const value = instance[prop as keyof Stripe];
		if (typeof value === "function") {
			return value.bind(instance);
		}
		return value;
	},
});

/**
 * Create a Stripe customer for an organization
 */
export async function createCustomer(params: {
	email: string;
	name: string;
	metadata?: Record<string, string>;
}): Promise<Stripe.Customer> {
	return stripe.customers.create({
		email: params.email,
		name: params.name,
		metadata: params.metadata,
	});
}

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(params: {
	customerId: string;
	priceId: string;
	successUrl: string;
	cancelUrl: string;
	trialDays?: number;
	metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
	return stripe.checkout.sessions.create({
		customer: params.customerId,
		mode: "subscription",
		payment_method_types: ["card"],
		line_items: [
			{
				price: params.priceId,
				quantity: 1,
			},
		],
		subscription_data: params.trialDays
			? {
					trial_period_days: params.trialDays,
					metadata: params.metadata,
				}
			: {
					metadata: params.metadata,
				},
		success_url: params.successUrl,
		cancel_url: params.cancelUrl,
		metadata: params.metadata,
	});
}

/**
 * Create a billing portal session for managing subscription
 */
export async function createBillingPortalSession(params: {
	customerId: string;
	returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
	return stripe.billingPortal.sessions.create({
		customer: params.customerId,
		return_url: params.returnUrl,
	});
}

/**
 * Get customer's active subscription
 */
export async function getActiveSubscription(
	customerId: string
): Promise<Stripe.Subscription | null> {
	const subscriptions = await stripe.subscriptions.list({
		customer: customerId,
		status: "all",
		limit: 1,
	});

	// Return active or trialing subscription
	const active = subscriptions.data.find(
		(sub) => sub.status === "active" || sub.status === "trialing"
	);

	return active || null;
}

/**
 * Cancel a subscription at period end
 */
export async function cancelSubscription(
	subscriptionId: string
): Promise<Stripe.Subscription> {
	return stripe.subscriptions.update(subscriptionId, {
		cancel_at_period_end: true,
	});
}

/**
 * Verify webhook signature
 */
export function constructWebhookEvent(
	payload: string | Buffer,
	signature: string
): Stripe.Event {
	if (!process.env.STRIPE_WEBHOOK_SECRET) {
		throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
	}
	return stripe.webhooks.constructEvent(
		payload,
		signature,
		process.env.STRIPE_WEBHOOK_SECRET
	);
}
