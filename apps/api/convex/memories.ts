import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const now = () => Date.now();

/**
 * Create a new memory (human context for AI)
 */
export const createMemory = mutation({
	args: {
		orgId: v.id("organizations"),
		repoId: v.optional(v.id("repositories")), // null = org-wide
		context: v.string(),
		tags: v.array(v.string()),
		linkedFiles: v.array(v.string()),
		createdBy: v.id("users"),
	},
	handler: async (ctx, args) => {
		const memoryId = await ctx.db.insert("memories", {
			orgId: args.orgId,
			repoId: args.repoId,
			context: args.context,
			tags: args.tags,
			linkedFiles: args.linkedFiles,
			createdBy: args.createdBy,
			createdAt: now(),
			updatedAt: null,
		});
		return { memoryId };
	},
});

/**
 * Update an existing memory
 */
export const updateMemory = mutation({
	args: {
		memoryId: v.id("memories"),
		context: v.optional(v.string()),
		tags: v.optional(v.array(v.string())),
		linkedFiles: v.optional(v.array(v.string())),
	},
	handler: async (ctx, args) => {
		const { memoryId, ...updates } = args;

		const existing = await ctx.db.get(memoryId);
		if (!existing) {
			throw new Error("Memory not found");
		}

		const patch: Record<string, unknown> = { updatedAt: now() };
		if (updates.context !== undefined) patch.context = updates.context;
		if (updates.tags !== undefined) patch.tags = updates.tags;
		if (updates.linkedFiles !== undefined) patch.linkedFiles = updates.linkedFiles;

		await ctx.db.patch(memoryId, patch);
		return { success: true };
	},
});

/**
 * Delete a memory
 */
export const deleteMemory = mutation({
	args: {
		memoryId: v.id("memories"),
	},
	handler: async (ctx, args) => {
		await ctx.db.delete(args.memoryId);
		return { success: true };
	},
});

/**
 * List all memories for an organization (optionally filtered by repo)
 */
export const listMemories = query({
	args: {
		orgId: v.id("organizations"),
		repoId: v.optional(v.id("repositories")),
		tag: v.optional(v.string()), // filter by tag
	},
	handler: async (ctx, args) => {
		let memories = await ctx.db
			.query("memories")
			.withIndex("by_org", (q) => q.eq("orgId", args.orgId))
			.collect();

		// Filter by repo if specified
		if (args.repoId !== undefined) {
			memories = memories.filter(
				(m) => m.repoId === args.repoId || m.repoId === undefined
			);
		}

		// Filter by tag if specified
		if (args.tag) {
			memories = memories.filter((m) => m.tags.includes(args.tag!));
		}

		// Fetch creator info for each memory
		const withCreators = await Promise.all(
			memories.map(async (m) => {
				const creator = await ctx.db.get(m.createdBy);
				return {
					...m,
					creatorName: creator?.name || creator?.email || "Unknown",
				};
			})
		);

		// Sort by creation date (newest first)
		withCreators.sort((a, b) => b.createdAt - a.createdAt);

		return withCreators;
	},
});

/**
 * Get all memories that apply to a specific repository
 * This merges org-wide memories with repo-specific ones
 */
export const getMemoriesForRepo = query({
	args: {
		orgId: v.id("organizations"),
		repoId: v.id("repositories"),
	},
	handler: async (ctx, args) => {
		const memories = await ctx.db
			.query("memories")
			.withIndex("by_org", (q) => q.eq("orgId", args.orgId))
			.collect();

		// Filter to only memories that apply to this repo
		// (org-wide OR repo-specific)
		const applicable = memories.filter(
			(m) => m.repoId === undefined || m.repoId === args.repoId
		);

		// Sort: repo-specific first, then by creation date
		applicable.sort((a, b) => {
			if (a.repoId && !b.repoId) return -1;
			if (!a.repoId && b.repoId) return 1;
			return b.createdAt - a.createdAt;
		});

		return applicable;
	},
});

/**
 * Get a single memory by ID
 */
export const getMemory = query({
	args: {
		memoryId: v.id("memories"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.memoryId);
	},
});

/**
 * Get all unique tags used in memories for an organization
 */
export const getMemoryTags = query({
	args: {
		orgId: v.id("organizations"),
	},
	handler: async (ctx, args) => {
		const memories = await ctx.db
			.query("memories")
			.withIndex("by_org", (q) => q.eq("orgId", args.orgId))
			.collect();

		const tagSet = new Set<string>();
		for (const memory of memories) {
			for (const tag of memory.tags) {
				tagSet.add(tag);
			}
		}

		return Array.from(tagSet).sort();
	},
});

/**
 * Get memory stats for an organization
 */
export const getMemoryStats = query({
	args: {
		orgId: v.id("organizations"),
	},
	handler: async (ctx, args) => {
		const memories = await ctx.db
			.query("memories")
			.withIndex("by_org", (q) => q.eq("orgId", args.orgId))
			.collect();

		const orgWide = memories.filter((m) => m.repoId === undefined);
		const repoSpecific = memories.filter((m) => m.repoId !== undefined);

		// Count unique tags
		const tagSet = new Set<string>();
		for (const memory of memories) {
			for (const tag of memory.tags) {
				tagSet.add(tag);
			}
		}

		// Count unique linked files
		const fileSet = new Set<string>();
		for (const memory of memories) {
			for (const file of memory.linkedFiles) {
				fileSet.add(file);
			}
		}

		return {
			total: memories.length,
			orgWide: orgWide.length,
			repoSpecific: repoSpecific.length,
			uniqueTags: tagSet.size,
			linkedFiles: fileSet.size,
		};
	},
});
