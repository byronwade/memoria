import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const now = () => Date.now();

// Helper for creating union of literals
const literals = <T extends string>(...values: T[]) =>
	v.union(...values.map((val) => v.literal(val))) as ReturnType<typeof v.literal<T>>;

const subscriptionStatusValidator = literals("active", "trialing", "past_due", "canceled", "incomplete", "paused");

/**
 * Update user billing info (Stripe customer ID, subscription info)
 */
export const updateUserBilling = mutation({
	args: {
		userId: v.id("users"),
		stripeCustomerId: v.optional(v.string()),
		stripeSubscriptionId: v.optional(v.string()),
		planTier: v.optional(literals("free", "pro", "team")),
		subscriptionStatus: v.optional(literals("active", "trial", "past_due", "canceled", "suspended")),
		trialEndsAt: v.optional(v.number()),
		maxRepos: v.optional(v.number()),
		maxAnalysesPerMonth: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const { userId, ...updates } = args;
		const updateData: Record<string, unknown> = { updatedAt: now() };

		if (updates.stripeCustomerId !== undefined) updateData.stripeCustomerId = updates.stripeCustomerId;
		if (updates.stripeSubscriptionId !== undefined) updateData.stripeSubscriptionId = updates.stripeSubscriptionId;
		if (updates.planTier !== undefined) updateData.planTier = updates.planTier;
		if (updates.subscriptionStatus !== undefined) updateData.subscriptionStatus = updates.subscriptionStatus;
		if (updates.trialEndsAt !== undefined) updateData.trialEndsAt = updates.trialEndsAt;
		if (updates.maxRepos !== undefined) updateData.maxRepos = updates.maxRepos;
		if (updates.maxAnalysesPerMonth !== undefined) updateData.maxAnalysesPerMonth = updates.maxAnalysesPerMonth;

		await ctx.db.patch(userId, updateData);
		return { success: true };
	},
});

/**
 * Record usage for billing period
 */
export const recordUsage = mutation({
	args: {
		userId: v.id("users"),
		periodStart: v.number(),
		periodEnd: v.number(),
		prAnalysesCountDelta: v.number(),
		reposActiveCountDelta: v.number(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("billing_usage")
			.withIndex("by_userId_period", (q) =>
				q.eq("userId", args.userId).eq("periodStart", args.periodStart).eq("periodEnd", args.periodEnd),
			)
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				prAnalysesCount: existing.prAnalysesCount + args.prAnalysesCountDelta,
				reposActiveCount: existing.reposActiveCount + args.reposActiveCountDelta,
			});
			return { usageId: existing._id };
		}

		const usageId = await ctx.db.insert("billing_usage", {
			userId: args.userId,
			periodStart: args.periodStart,
			periodEnd: args.periodEnd,
			prAnalysesCount: args.prAnalysesCountDelta,
			reposActiveCount: args.reposActiveCountDelta,
			extraUsageMetadata: null,
			createdAt: now(),
		});
		return { usageId };
	},
});

export const recordBillingEvent = mutation({
	args: {
		stripeEventId: v.string(),
		type: v.string(),
		payload: v.any(),
		processedAt: v.union(v.number(), v.null()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("billing_events")
			.withIndex("by_stripeEventId", (q) => q.eq("stripeEventId", args.stripeEventId))
			.first();
		if (existing) return { billingEventId: existing._id };

		const billingEventId = await ctx.db.insert("billing_events", {
			...args,
			createdAt: now(),
		});
		return { billingEventId };
	},
});

// ============ QUERIES ============

export const getPlans = query({
	args: {},
	handler: async (ctx) => {
		const plans = await ctx.db
			.query("billing_plans")
			.filter((q) => q.eq(q.field("isPublic"), true))
			.collect();
		return plans.sort((a, b) => a.pricePerMonthUsd - b.pricePerMonthUsd);
	},
});

export const getPlanById = query({
	args: { planId: v.id("billing_plans") },
	handler: async (ctx, args) => {
		return ctx.db.get(args.planId);
	},
});

export const getPlanByTier = query({
	args: { tier: v.string() },
	handler: async (ctx, args) => {
		return ctx.db
			.query("billing_plans")
			.filter((q) => q.eq(q.field("tier"), args.tier))
			.first();
	},
});

export const getPlanByStripePrice = query({
	args: { stripePriceId: v.string() },
	handler: async (ctx, args) => {
		return ctx.db
			.query("billing_plans")
			.filter((q) => q.eq(q.field("stripePriceId"), args.stripePriceId))
			.first();
	},
});

export const getCurrentUsage = query({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		// Get current billing period usage
		const currentTime = now();
		const usage = await ctx.db
			.query("billing_usage")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.filter((q) =>
				q.and(
					q.lte(q.field("periodStart"), currentTime),
					q.gte(q.field("periodEnd"), currentTime)
				)
			)
			.first();

		return usage || { prAnalysesCount: 0, reposActiveCount: 0 };
	},
});

export const getUserBillingStatus = query({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		const user = await ctx.db.get(args.userId);
		if (!user) return null;

		const currentTime = now();
		const isTrialing = user.trialEndsAt ? user.trialEndsAt > currentTime : false;
		const trialDaysRemaining = user.trialEndsAt
			? Math.max(0, Math.ceil((user.trialEndsAt - currentTime) / (1000 * 60 * 60 * 24)))
			: 0;

		// Count active repos
		const repos = await ctx.db
			.query("repositories")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.filter((q) => q.eq(q.field("isActive"), true))
			.collect();

		return {
			userId: user._id,
			planTier: user.planTier || "free",
			subscriptionStatus: user.subscriptionStatus || "active",
			isTrialing,
			trialDaysRemaining,
			trialEndsAt: user.trialEndsAt,
			maxRepos: user.maxRepos,
			maxAnalysesPerMonth: user.maxAnalysesPerMonth,
			activeReposCount: repos.length,
			stripeCustomerId: user.stripeCustomerId,
			stripeSubscriptionId: user.stripeSubscriptionId,
		};
	},
});

export const getUserByStripeCustomerId = query({
	args: { stripeCustomerId: v.string() },
	handler: async (ctx, args) => {
		return ctx.db
			.query("users")
			.withIndex("by_stripeCustomerId", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
			.first();
	},
});

// ============ ADDITIONAL MUTATIONS ============

export const createFreePlan = mutation({
	args: {},
	handler: async (ctx) => {
		// Check if free plan exists
		const existing = await ctx.db
			.query("billing_plans")
			.filter((q) => q.eq(q.field("tier"), "free"))
			.first();

		if (existing) return { planId: existing._id };

		const planId = await ctx.db.insert("billing_plans", {
			name: "Free",
			tier: "free",
			stripePriceId: null,
			maxRepos: 3,
			maxAnalysesPerMonth: 50,
			pricePerMonthUsd: 0,
			features: ["3 repositories", "50 PR analyses/month", "Basic risk reports"],
			isPublic: true,
			createdAt: now(),
		});
		return { planId };
	},
});

export const seedPlans = mutation({
	args: {},
	handler: async (ctx) => {
		const plans = [
			{
				name: "Free",
				tier: "free",
				stripePriceId: null,
				maxRepos: 3,
				maxAnalysesPerMonth: 50,
				pricePerMonthUsd: 0,
				features: ["3 repositories", "All 13 git analysis engines", "MCP + CLI included", "Works offline"],
				isPublic: true,
			},
			{
				name: "Pro",
				tier: "pro",
				stripePriceId: process.env.STRIPE_PRO_PRICE_ID || null,
				maxRepos: -1, // unlimited
				maxAnalysesPerMonth: -1, // unlimited
				pricePerMonthUsd: 5,
				features: ["Unlimited repositories", "Unlimited cloud memories", "Personal guardrails (10 rules)", "Dashboard & analytics", "Email support"],
				isPublic: true,
			},
			{
				name: "Team",
				tier: "team",
				stripePriceId: process.env.STRIPE_TEAM_PRICE_ID || null,
				maxRepos: -1, // unlimited
				maxAnalysesPerMonth: -1, // unlimited
				pricePerMonthUsd: 8,
				features: ["Everything in Pro", "Team-wide shared memories", "Unlimited guardrails", "Org-level analytics", "Priority support"],
				isPublic: true,
			},
		];

		const results = [];
		for (const plan of plans) {
			const existing = await ctx.db
				.query("billing_plans")
				.filter((q) => q.eq(q.field("tier"), plan.tier))
				.first();

			if (existing) {
				await ctx.db.patch(existing._id, { ...plan, updatedAt: now() });
				results.push({ tier: plan.tier, planId: existing._id, action: "updated" });
			} else {
				const planId = await ctx.db.insert("billing_plans", {
					...plan,
					createdAt: now(),
					updatedAt: null,
				});
				results.push({ tier: plan.tier, planId, action: "created" });
			}
		}

		return results;
	},
});
