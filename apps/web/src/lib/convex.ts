import { ConvexHttpClient } from "convex/browser";

/**
 * Server-side Convex HTTP client for API routes
 * Uses NEXT_PUBLIC_CONVEX_URL environment variable
 */
export function getConvexClient(): ConvexHttpClient {
	const url = process.env.NEXT_PUBLIC_CONVEX_URL;
	if (!url) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
	}
	return new ConvexHttpClient(url);
}

/**
 * Type-safe wrapper for calling Convex mutations from API routes
 */
export async function callMutation<T>(
	client: ConvexHttpClient,
	mutation: string,
	args: Record<string, unknown>
): Promise<T> {
	// @ts-expect-error - Convex client accepts string paths
	return client.mutation(mutation, args);
}

/**
 * Type-safe wrapper for calling Convex queries from API routes
 */
export async function callQuery<T>(
	client: ConvexHttpClient,
	query: string,
	args: Record<string, unknown>
): Promise<T> {
	// @ts-expect-error - Convex client accepts string paths
	return client.query(query, args);
}
