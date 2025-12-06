import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const now = () => Date.now();

// Helper for creating union of literals
const literals = <T extends string>(...values: T[]) =>
	v.union(...values.map((val) => v.literal(val))) as ReturnType<typeof v.literal<T>>;

const actionValidator = literals("blocked", "warned");

/**
 * Record an intervention (called by MCP server when it enforces a guardrail)
 */
export const recordIntervention = mutation({
	args: {
		userId: v.id("users"),
		repoId: v.id("repositories"),
		guardrailId: v.optional(v.id("guardrails")),
		filePath: v.string(),
		action: actionValidator,
		aiTool: v.string(),
		aiModel: v.optional(v.string()),
		context: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const interventionId = await ctx.db.insert("interventions", {
			userId: args.userId,
			repoId: args.repoId,
			guardrailId: args.guardrailId,
			filePath: args.filePath,
			action: args.action,
			aiTool: args.aiTool,
			aiModel: args.aiModel ?? null,
			context: args.context ?? null,
			timestamp: now(),
		});
		return { interventionId };
	},
});

/**
 * List interventions for a user with pagination
 */
export const listInterventions = query({
	args: {
		userId: v.id("users"),
		repoId: v.optional(v.id("repositories")),
		limit: v.optional(v.number()),
		cursor: v.optional(v.number()), // timestamp cursor for pagination
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 50;

		let interventions = await ctx.db
			.query("interventions")
			.withIndex("by_userId_timestamp", (q) => q.eq("userId", args.userId))
			.order("desc")
			.collect();

		// Filter by repo if specified
		if (args.repoId !== undefined) {
			interventions = interventions.filter((i) => i.repoId === args.repoId);
		}

		// Apply cursor (skip items newer than cursor)
		if (args.cursor !== undefined) {
			interventions = interventions.filter((i) => i.timestamp < args.cursor!);
		}

		// Limit results
		const items = interventions.slice(0, limit);

		// Get next cursor
		const nextCursor = items.length === limit ? items[items.length - 1].timestamp : undefined;

		// Fetch related data (guardrail info, repo info)
		const enriched = await Promise.all(
			items.map(async (intervention) => {
				const guardrail = intervention.guardrailId
					? await ctx.db.get(intervention.guardrailId)
					: null;
				const repo = await ctx.db.get(intervention.repoId);

				return {
					...intervention,
					guardrailPattern: guardrail?.pattern ?? null,
					guardrailMessage: guardrail?.message ?? null,
					repoName: repo?.fullName ?? "Unknown",
				};
			})
		);

		return {
			items: enriched,
			nextCursor,
		};
	},
});

/**
 * Get intervention statistics for the dashboard
 */
export const getInterventionStats = query({
	args: {
		userId: v.id("users"),
		repoId: v.optional(v.id("repositories")),
	},
	handler: async (ctx, args) => {
		let interventions = await ctx.db
			.query("interventions")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();

		// Filter by repo if specified
		if (args.repoId !== undefined) {
			interventions = interventions.filter((i) => i.repoId === args.repoId);
		}

		const total = interventions.length;
		const blocked = interventions.filter((i) => i.action === "blocked").length;
		const warned = interventions.filter((i) => i.action === "warned").length;

		// Last 7 days
		const sevenDaysAgo = now() - 7 * 24 * 60 * 60 * 1000;
		const last7Days = interventions.filter((i) => i.timestamp > sevenDaysAgo).length;

		// Last 30 days
		const thirtyDaysAgo = now() - 30 * 24 * 60 * 60 * 1000;
		const last30Days = interventions.filter((i) => i.timestamp > thirtyDaysAgo).length;

		// Today
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const today = interventions.filter((i) => i.timestamp > todayStart.getTime()).length;

		// By AI tool
		const byTool: Record<string, number> = {};
		for (const intervention of interventions) {
			byTool[intervention.aiTool] = (byTool[intervention.aiTool] || 0) + 1;
		}

		return {
			total,
			blocked,
			warned,
			today,
			last7Days,
			last30Days,
			byTool,
		};
	},
});

/**
 * Get intervention trend data (for charts)
 */
export const getInterventionTrend = query({
	args: {
		userId: v.id("users"),
		repoId: v.optional(v.id("repositories")),
		days: v.optional(v.number()), // default 30
	},
	handler: async (ctx, args) => {
		const days = args.days ?? 30;
		const startTime = now() - days * 24 * 60 * 60 * 1000;

		let interventions = await ctx.db
			.query("interventions")
			.withIndex("by_userId_timestamp", (q) => q.eq("userId", args.userId))
			.collect();

		// Filter by repo if specified
		if (args.repoId !== undefined) {
			interventions = interventions.filter((i) => i.repoId === args.repoId);
		}

		// Filter to time range
		interventions = interventions.filter((i) => i.timestamp > startTime);

		// Group by date
		const byDate: Record<string, { blocked: number; warned: number }> = {};

		for (const intervention of interventions) {
			const date = new Date(intervention.timestamp).toISOString().split("T")[0];
			if (!byDate[date]) {
				byDate[date] = { blocked: 0, warned: 0 };
			}
			if (intervention.action === "blocked") {
				byDate[date].blocked++;
			} else {
				byDate[date].warned++;
			}
		}

		// Fill in missing dates
		const result: Array<{ date: string; blocked: number; warned: number }> = [];
		const current = new Date(startTime);
		const end = new Date();

		while (current <= end) {
			const date = current.toISOString().split("T")[0];
			result.push({
				date,
				blocked: byDate[date]?.blocked ?? 0,
				warned: byDate[date]?.warned ?? 0,
			});
			current.setDate(current.getDate() + 1);
		}

		return result;
	},
});

/**
 * Get most frequently blocked files
 */
export const getMostBlockedFiles = query({
	args: {
		userId: v.id("users"),
		repoId: v.optional(v.id("repositories")),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 10;

		let interventions = await ctx.db
			.query("interventions")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();

		// Filter by repo if specified
		if (args.repoId !== undefined) {
			interventions = interventions.filter((i) => i.repoId === args.repoId);
		}

		// Count by file path
		const byFile: Record<string, { blocked: number; warned: number }> = {};
		for (const intervention of interventions) {
			if (!byFile[intervention.filePath]) {
				byFile[intervention.filePath] = { blocked: 0, warned: 0 };
			}
			if (intervention.action === "blocked") {
				byFile[intervention.filePath].blocked++;
			} else {
				byFile[intervention.filePath].warned++;
			}
		}

		// Sort by total interventions
		const sorted = Object.entries(byFile)
			.map(([filePath, counts]) => ({
				filePath,
				...counts,
				total: counts.blocked + counts.warned,
			}))
			.sort((a, b) => b.total - a.total)
			.slice(0, limit);

		return sorted;
	},
});
