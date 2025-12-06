import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const now = () => Date.now();

// Helper for creating union of literals
const literals = <T extends string>(...values: T[]) =>
	v.union(...values.map((val) => v.literal(val))) as ReturnType<typeof v.literal<T>>;

const subscriptionStatusValidator = literals("active", "trialing", "past_due", "canceled", "incomplete", "paused");

export const upsertBillingCustomer = mutation({
	args: {
		orgId: v.id("organizations"),
		stripeCustomerId: v.string(),
		defaultPaymentMethodId: v.union(v.string(), v.null()),
		metadata: v.union(v.any(), v.null()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("billing_customers")
			.withIndex("by_org", (q) => q.eq("orgId", args.orgId))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				defaultPaymentMethodId: args.defaultPaymentMethodId,
				metadata: args.metadata,
				updatedAt: now(),
			});
			return { billingCustomerId: existing._id };
		}

		const billingCustomerId = await ctx.db.insert("billing_customers", {
			...args,
			createdAt: now(),
			updatedAt: null,
		});
		return { billingCustomerId };
	},
});

export const upsertSubscription = mutation({
	args: {
		orgId: v.id("organizations"),
		stripeSubscriptionId: v.string(),
		planId: v.id("billing_plans"),
		status: subscriptionStatusValidator,
		currentPeriodStart: v.number(),
		currentPeriodEnd: v.number(),
		cancelAtPeriodEnd: v.boolean(),
		canceledAt: v.union(v.number(), v.null()),
		metadata: v.union(v.any(), v.null()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("billing_subscriptions")
			.withIndex("by_stripeSubscriptionId", (q) => q.eq("stripeSubscriptionId", args.stripeSubscriptionId))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				...args,
				updatedAt: now(),
			});
			return { subscriptionId: existing._id };
		}

		const subscriptionId = await ctx.db.insert("billing_subscriptions", {
			...args,
			createdAt: now(),
			updatedAt: null,
		});

		await ctx.db.patch(args.orgId, {
			planId: args.planId,
			stripeSubscriptionId: args.stripeSubscriptionId,
			updatedAt: now(),
		});

		return { subscriptionId };
	},
});

export const recordUsage = mutation({
	args: {
		orgId: v.id("organizations"),
		periodStart: v.number(),
		periodEnd: v.number(),
		prAnalysesCountDelta: v.number(),
		reposActiveCountDelta: v.number(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("billing_usage")
			.withIndex("by_org_period", (q) =>
				q.eq("orgId", args.orgId).eq("periodStart", args.periodStart).eq("periodEnd", args.periodEnd),
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
			orgId: args.orgId,
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

export const getSubscription = query({
	args: { orgId: v.id("organizations") },
	handler: async (ctx, args) => {
		const subscription = await ctx.db
			.query("billing_subscriptions")
			.withIndex("by_org", (q) => q.eq("orgId", args.orgId))
			.first();

		if (!subscription) return null;

		const plan = await ctx.db.get(subscription.planId);
		return { ...subscription, plan };
	},
});

export const getBillingCustomer = query({
	args: { orgId: v.id("organizations") },
	handler: async (ctx, args) => {
		return ctx.db
			.query("billing_customers")
			.withIndex("by_org", (q) => q.eq("orgId", args.orgId))
			.first();
	},
});

export const getBillingCustomerByStripeId = query({
	args: { stripeCustomerId: v.string() },
	handler: async (ctx, args) => {
		return ctx.db
			.query("billing_customers")
			.withIndex("by_stripeCustomerId", (q) => q.eq("stripeCustomerId", args.stripeCustomerId))
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
	args: { orgId: v.id("organizations") },
	handler: async (ctx, args) => {
		// Get current billing period usage
		const currentTime = now();
		const usage = await ctx.db
			.query("billing_usage")
			.withIndex("by_org", (q) => q.eq("orgId", args.orgId))
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

export const getOrgBillingStatus = query({
	args: { orgId: v.id("organizations") },
	handler: async (ctx, args) => {
		const org = await ctx.db.get(args.orgId);
		if (!org) return null;

		const subscription = await ctx.db
			.query("billing_subscriptions")
			.withIndex("by_org", (q) => q.eq("orgId", args.orgId))
			.first();

		const plan = org.planId ? await ctx.db.get(org.planId) : null;

		const currentTime = now();
		const isTrialing = org.trialEndsAt ? org.trialEndsAt > currentTime : false;
		const trialDaysRemaining = org.trialEndsAt
			? Math.max(0, Math.ceil((org.trialEndsAt - currentTime) / (1000 * 60 * 60 * 24)))
			: 0;

		// Count active repos
		const repos = await ctx.db
			.query("repositories")
			.withIndex("by_org", (q) => q.eq("orgId", args.orgId))
			.filter((q) => q.eq(q.field("isActive"), true))
			.collect();

		return {
			orgId: org._id,
			status: org.status,
			plan,
			subscription,
			isTrialing,
			trialDaysRemaining,
			trialEndsAt: org.trialEndsAt,
			maxRepos: org.maxRepos,
			maxAnalysesPerMonth: org.maxAnalysesPerMonth,
			activeReposCount: repos.length,
			stripeCustomerId: org.stripeCustomerId,
		};
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
			maxRepos: 1,
			maxAnalysesPerMonth: 50,
			pricePerMonthUsd: 0,
			features: ["1 repository", "50 PR analyses/month", "Basic risk reports"],
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
				maxRepos: 1,
				maxAnalysesPerMonth: 50,
				pricePerMonthUsd: 0,
				features: ["1 repository", "50 PR analyses/month", "Basic risk reports"],
				isPublic: true,
			},
			{
				name: "Solo",
				tier: "solo",
				stripePriceId: process.env.STRIPE_SOLO_PRICE_ID || null,
				maxRepos: 5,
				maxAnalysesPerMonth: 500,
				pricePerMonthUsd: 19,
				features: ["5 repositories", "500 PR analyses/month", "Full risk reports", "Priority support"],
				isPublic: true,
			},
			{
				name: "Team",
				tier: "team",
				stripePriceId: process.env.STRIPE_TEAM_PRICE_ID || null,
				maxRepos: 25,
				maxAnalysesPerMonth: 2500,
				pricePerMonthUsd: 49,
				features: ["25 repositories", "2500 PR analyses/month", "Team dashboard", "API access", "Priority support"],
				isPublic: true,
			},
			{
				name: "Enterprise",
				tier: "enterprise",
				stripePriceId: null,
				maxRepos: -1, // unlimited
				maxAnalysesPerMonth: -1, // unlimited
				pricePerMonthUsd: 199,
				features: ["Unlimited repositories", "Unlimited analyses", "Dedicated support", "Custom integrations", "SLA"],
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

export const updateOrgBillingStatus = mutation({
	args: {
		orgId: v.id("organizations"),
		status: v.optional(v.string()),
		planId: v.optional(v.id("billing_plans")),
		stripeCustomerId: v.optional(v.string()),
		stripeSubscriptionId: v.optional(v.string()),
		trialEndsAt: v.optional(v.number()),
		maxRepos: v.optional(v.number()),
		maxAnalysesPerMonth: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const { orgId, ...updates } = args;
		const updateData: Record<string, unknown> = { updatedAt: now() };

		if (updates.status !== undefined) updateData.status = updates.status;
		if (updates.planId !== undefined) updateData.planId = updates.planId;
		if (updates.stripeCustomerId !== undefined) updateData.stripeCustomerId = updates.stripeCustomerId;
		if (updates.stripeSubscriptionId !== undefined) updateData.stripeSubscriptionId = updates.stripeSubscriptionId;
		if (updates.trialEndsAt !== undefined) updateData.trialEndsAt = updates.trialEndsAt;
		if (updates.maxRepos !== undefined) updateData.maxRepos = updates.maxRepos;
		if (updates.maxAnalysesPerMonth !== undefined) updateData.maxAnalysesPerMonth = updates.maxAnalysesPerMonth;

		await ctx.db.patch(orgId, updateData);
		return { success: true };
	},
});

