import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const now = () => Date.now();

// Helper for creating union of literals
const literals = <T extends string>(...values: T[]) =>
	v.union(...values.map((val) => v.literal(val))) as ReturnType<typeof v.literal<T>>;

const sourceValidator = literals("github", "gitlab", "stripe", "bitbucket", "other");
const processingStatusValidator = literals("processed", "error", "pending");
const targetTypeValidator = literals("slack", "webhook", "other");
const outboundStatusValidator = literals("pending", "sent", "error");

export const getWebhook = query({
	args: { webhookId: v.id("inbound_webhooks") },
	handler: async (ctx, args) => ctx.db.get(args.webhookId),
});

export const storeInboundWebhook = mutation({
	args: {
		source: sourceValidator,
		externalEventId: v.string(),
		eventType: v.string(),
		payload: v.any(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("inbound_webhooks")
			.withIndex("by_source_eventId", (q) =>
				q.eq("source", args.source).eq("externalEventId", args.externalEventId),
			)
			.first();
		if (existing) return { webhookId: existing._id };

		const webhookId = await ctx.db.insert("inbound_webhooks", {
			...args,
			processedAt: null,
			processingStatus: "pending",
			errorMessage: null,
			createdAt: now(),
		});
		return { webhookId };
	},
});

export const markWebhookProcessed = mutation({
	args: {
		webhookId: v.id("inbound_webhooks"),
		status: processingStatusValidator,
		errorMessage: v.optional(v.union(v.string(), v.null())),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.webhookId, {
			processingStatus: args.status,
			processedAt: args.status === "processed" ? now() : null,
			errorMessage: args.errorMessage ?? null,
		});
		return { updated: true };
	},
});

export const storeOutboundWebhook = mutation({
	args: {
		userId: v.id("users"),
		targetType: targetTypeValidator,
		targetUrl: v.string(),
		eventType: v.string(),
		payload: v.any(),
	},
	handler: async (ctx, args) => {
		const outboundId = await ctx.db.insert("outbound_webhooks", {
			...args,
			status: "pending",
			lastAttemptAt: null,
			attemptCount: 0,
			errorMessage: null,
			createdAt: now(),
		});
		return { outboundId };
	},
});

export const markOutboundResult = mutation({
	args: {
		outboundId: v.id("outbound_webhooks"),
		status: outboundStatusValidator,
		errorMessage: v.optional(v.union(v.string(), v.null())),
	},
	handler: async (ctx, args) => {
		const outbound = await ctx.db.get(args.outboundId);
		if (!outbound) return { updated: false };
		await ctx.db.patch(args.outboundId, {
			status: args.status,
			lastAttemptAt: now(),
			attemptCount: outbound.attemptCount + 1,
			errorMessage: args.errorMessage ?? null,
		});
		return { updated: true };
	},
});

/**
 * List recent inbound webhooks for debugging
 */
export const listRecentWebhooks = query({
	args: {
		source: v.optional(sourceValidator),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit || 20;
		let q = ctx.db.query("inbound_webhooks").order("desc");

		const webhooks = await q.take(limit);

		// Filter by source if specified
		if (args.source) {
			return webhooks.filter((w) => w.source === args.source);
		}

		return webhooks;
	},
});
