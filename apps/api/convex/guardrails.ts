import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const now = () => Date.now();

// Helper for creating union of literals
const literals = <T extends string>(...values: T[]) =>
	v.union(...values.map((val) => v.literal(val))) as ReturnType<typeof v.literal<T>>;

const levelValidator = literals("warn", "block");

/**
 * Create a new guardrail (rule) for protecting files/paths
 */
export const createGuardrail = mutation({
	args: {
		userId: v.id("users"),
		repoId: v.optional(v.id("repositories")), // null = user-wide
		pattern: v.string(),
		level: levelValidator,
		message: v.string(),
		createdBy: v.id("users"),
	},
	handler: async (ctx, args) => {
		const guardrailId = await ctx.db.insert("guardrails", {
			userId: args.userId,
			repoId: args.repoId,
			pattern: args.pattern,
			level: args.level,
			message: args.message,
			isEnabled: true,
			createdBy: args.createdBy,
			createdAt: now(),
			updatedAt: null,
		});
		return { guardrailId };
	},
});

/**
 * Update an existing guardrail
 */
export const updateGuardrail = mutation({
	args: {
		guardrailId: v.id("guardrails"),
		pattern: v.optional(v.string()),
		level: v.optional(levelValidator),
		message: v.optional(v.string()),
		isEnabled: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const { guardrailId, ...updates } = args;

		const existing = await ctx.db.get(guardrailId);
		if (!existing) {
			throw new Error("Guardrail not found");
		}

		const patch: Record<string, unknown> = { updatedAt: now() };
		if (updates.pattern !== undefined) patch.pattern = updates.pattern;
		if (updates.level !== undefined) patch.level = updates.level;
		if (updates.message !== undefined) patch.message = updates.message;
		if (updates.isEnabled !== undefined) patch.isEnabled = updates.isEnabled;

		await ctx.db.patch(guardrailId, patch);
		return { success: true };
	},
});

/**
 * Delete a guardrail
 */
export const deleteGuardrail = mutation({
	args: {
		guardrailId: v.id("guardrails"),
	},
	handler: async (ctx, args) => {
		await ctx.db.delete(args.guardrailId);
		return { success: true };
	},
});

/**
 * List all guardrails for a user (optionally filtered by repo)
 */
export const listGuardrails = query({
	args: {
		userId: v.id("users"),
		repoId: v.optional(v.id("repositories")),
		includeDisabled: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		let guardrails = await ctx.db
			.query("guardrails")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();

		// Filter by repo if specified
		if (args.repoId !== undefined) {
			guardrails = guardrails.filter(
				(g) => g.repoId === args.repoId || g.repoId === undefined
			);
		}

		// Filter out disabled unless requested
		if (!args.includeDisabled) {
			guardrails = guardrails.filter((g) => g.isEnabled);
		}

		// Fetch creator info for each guardrail
		const withCreators = await Promise.all(
			guardrails.map(async (g) => {
				const creator = await ctx.db.get(g.createdBy);
				return {
					...g,
					creatorName: creator?.name || creator?.email || "Unknown",
				};
			})
		);

		return withCreators;
	},
});

/**
 * Get all guardrails that apply to a specific repository
 * This merges user-wide defaults with repo-specific rules
 */
export const getGuardrailsForRepo = query({
	args: {
		userId: v.id("users"),
		repoId: v.id("repositories"),
	},
	handler: async (ctx, args) => {
		const guardrails = await ctx.db
			.query("guardrails")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();

		// Filter to only enabled guardrails that apply to this repo
		// (user-wide OR repo-specific)
		const applicable = guardrails.filter(
			(g) => g.isEnabled && (g.repoId === undefined || g.repoId === args.repoId)
		);

		// Sort: repo-specific rules first (they take precedence)
		applicable.sort((a, b) => {
			if (a.repoId && !b.repoId) return -1;
			if (!a.repoId && b.repoId) return 1;
			return 0;
		});

		return applicable;
	},
});

/**
 * Get a single guardrail by ID
 */
export const getGuardrail = query({
	args: {
		guardrailId: v.id("guardrails"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.guardrailId);
	},
});

/**
 * Get guardrail stats for a user
 */
export const getGuardrailStats = query({
	args: {
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const guardrails = await ctx.db
			.query("guardrails")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();

		const enabled = guardrails.filter((g) => g.isEnabled);
		const blocking = enabled.filter((g) => g.level === "block");
		const warning = enabled.filter((g) => g.level === "warn");
		const userWide = enabled.filter((g) => g.repoId === undefined);
		const repoSpecific = enabled.filter((g) => g.repoId !== undefined);

		return {
			total: guardrails.length,
			enabled: enabled.length,
			disabled: guardrails.length - enabled.length,
			blocking: blocking.length,
			warning: warning.length,
			userWide: userWide.length,
			repoSpecific: repoSpecific.length,
		};
	},
});
