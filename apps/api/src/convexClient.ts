import { ConvexHttpClient } from "convex/browser";
import type { AppConfig } from "./config.js";

export type ConvexFunctionName = `${string}:${string}`;

export interface ConvexClient {
	mutation<Response = unknown, Args = Record<string, unknown>>(name: ConvexFunctionName, args: Args): Promise<Response>;
	query<Response = unknown, Args = Record<string, unknown>>(name: ConvexFunctionName, args: Args): Promise<Response>;
	isEnabled(): boolean;
}

class NoopConvexClient implements ConvexClient {
	isEnabled(): boolean {
		return false;
	}

	async mutation(): Promise<never> {
		throw new Error("Convex URL is not configured");
	}

	async query(): Promise<never> {
		throw new Error("Convex URL is not configured");
	}
}

class HttpConvexClient implements ConvexClient {
	private readonly client: ConvexHttpClient;

	constructor(convexUrl: string, adminKey?: string) {
		this.client = new ConvexHttpClient(convexUrl);
		this.adminKey = adminKey;
	}

	private readonly adminKey?: string;

	isEnabled(): boolean {
		return true;
	}

	mutation<Response = unknown, Args = Record<string, unknown>>(name: ConvexFunctionName, args: Args): Promise<Response> {
		const client = this.client as unknown as {
			mutation: (functionName: string, payload: Record<string, unknown>, options?: Record<string, unknown>) => Promise<Response>;
		};
		const options = this.adminKey ? { adminAuth: this.adminKey } : undefined;
		return client.mutation(name, args as Record<string, unknown>, options);
	}

	query<Response = unknown, Args = Record<string, unknown>>(name: ConvexFunctionName, args: Args): Promise<Response> {
		const client = this.client as unknown as {
			query: (functionName: string, payload: Record<string, unknown>, options?: Record<string, unknown>) => Promise<Response>;
		};
		const options = this.adminKey ? { adminAuth: this.adminKey } : undefined;
		return client.query(name, args as Record<string, unknown>, options);
	}
}

export function createConvexClient(config: AppConfig): ConvexClient {
	if (!config.CONVEX_URL) {
		return new NoopConvexClient();
	}
	return new HttpConvexClient(config.CONVEX_URL, config.CONVEX_ADMIN_KEY);
}

