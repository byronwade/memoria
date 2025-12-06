"use client";

import { loadStripe, Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null>;

export function getStripe(): Promise<Stripe | null> {
	if (!stripePromise) {
		const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
		if (!key) {
			console.error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured");
			return Promise.resolve(null);
		}
		stripePromise = loadStripe(key);
	}
	return stripePromise;
}

/**
 * Redirect to Stripe Checkout
 * Uses the session URL directly (modern approach - redirectToCheckout is deprecated)
 */
export async function redirectToCheckout(sessionUrl: string): Promise<void> {
	if (!sessionUrl) {
		throw new Error("Checkout session URL is required");
	}
	window.location.href = sessionUrl;
}
