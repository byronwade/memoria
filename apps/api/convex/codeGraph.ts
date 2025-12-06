import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const now = () => Date.now();

// Helper for creating union of literals (matches schema.ts)
const literals = <T extends string>(...values: T[]) =>
	v.union(...values.map((val) => v.literal(val))) as ReturnType<typeof v.literal<T>>;

// ============================================
// CODE FILE MUTATIONS
// ============================================

/**
 * Create or update a code file node in the graph
 */
export const upsertCodeFile = mutation({
	args: {
		repoId: v.id("repositories"),
		filePath: v.string(),
		language: v.string(),
		exports: v.array(
			v.object({
				name: v.string(),
				kind: literals("function", "class", "const", "type", "interface", "variable"),
				signature: v.optional(v.string()),
				line: v.number(),
			}),
		),
		imports: v.array(
			v.object({
				source: v.string(),
				specifiers: v.array(v.string()),
				isRelative: v.boolean(),
			}),
		),
		keywords: v.array(v.string()),
		riskScore: v.number(),
	},
	handler: async (ctx, args) => {
		// Check if file already exists
		const existing = await ctx.db
			.query("code_files")
			.withIndex("by_repo_path", (q) =>
				q.eq("repoId", args.repoId).eq("filePath", args.filePath)
			)
			.first();

		if (existing) {
			// Update existing
			await ctx.db.patch(existing._id, {
				language: args.language,
				exports: args.exports,
				imports: args.imports,
				keywords: args.keywords,
				riskScore: args.riskScore,
				lastIndexedAt: now(),
			});
			return { fileId: existing._id, updated: true };
		}

		// Create new
		const fileId = await ctx.db.insert("code_files", {
			repoId: args.repoId,
			filePath: args.filePath,
			language: args.language,
			exports: args.exports,
			imports: args.imports,
			keywords: args.keywords,
			riskScore: args.riskScore,
			lastIndexedAt: now(),
			createdAt: now(),
		});
		return { fileId, updated: false };
	},
});

/**
 * Delete a code file node and its relationships
 */
export const deleteCodeFile = mutation({
	args: {
		fileId: v.id("code_files"),
	},
	handler: async (ctx, args) => {
		// Delete relationships where this file is source or target
		const asSource = await ctx.db
			.query("code_relationships")
			.withIndex("by_source", (q) => q.eq("sourceFileId", args.fileId))
			.collect();

		const asTarget = await ctx.db
			.query("code_relationships")
			.withIndex("by_target", (q) => q.eq("targetFileId", args.fileId))
			.collect();

		for (const rel of [...asSource, ...asTarget]) {
			await ctx.db.delete(rel._id);
		}

		// Delete memory links
		const memoryLinks = await ctx.db
			.query("memory_file_links")
			.withIndex("by_file", (q) => q.eq("codeFileId", args.fileId))
			.collect();

		for (const link of memoryLinks) {
			await ctx.db.delete(link._id);
		}

		// Delete the file itself
		await ctx.db.delete(args.fileId);
		return { success: true };
	},
});

/**
 * Update risk score for a file
 */
export const updateRiskScore = mutation({
	args: {
		fileId: v.id("code_files"),
		riskScore: v.number(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.fileId, {
			riskScore: args.riskScore,
			lastIndexedAt: now(),
		});
		return { success: true };
	},
});

// ============================================
// CODE RELATIONSHIP MUTATIONS
// ============================================

/**
 * Create or update a relationship between two files
 */
export const upsertRelationship = mutation({
	args: {
		repoId: v.id("repositories"),
		sourceFileId: v.id("code_files"),
		targetFileId: v.id("code_files"),
		type: literals("imports", "co_changes", "tests", "types", "transitive"),
		strength: v.number(),
		evidence: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Check if relationship already exists
		const existing = await ctx.db
			.query("code_relationships")
			.withIndex("by_source", (q) => q.eq("sourceFileId", args.sourceFileId))
			.filter((q) =>
				q.and(
					q.eq(q.field("targetFileId"), args.targetFileId),
					q.eq(q.field("type"), args.type)
				)
			)
			.first();

		if (existing) {
			// Update existing
			await ctx.db.patch(existing._id, {
				strength: args.strength,
				evidence: args.evidence,
				updatedAt: now(),
			});
			return { relationshipId: existing._id, updated: true };
		}

		// Create new
		const relationshipId = await ctx.db.insert("code_relationships", {
			repoId: args.repoId,
			sourceFileId: args.sourceFileId,
			targetFileId: args.targetFileId,
			type: args.type,
			strength: args.strength,
			evidence: args.evidence,
			createdAt: now(),
			updatedAt: null,
		});
		return { relationshipId, updated: false };
	},
});

/**
 * Batch upsert relationships (for efficiency)
 */
export const batchUpsertRelationships = mutation({
	args: {
		relationships: v.array(
			v.object({
				repoId: v.id("repositories"),
				sourceFileId: v.id("code_files"),
				targetFileId: v.id("code_files"),
				type: literals("imports", "co_changes", "tests", "types", "transitive"),
				strength: v.number(),
				evidence: v.optional(v.string()),
			}),
		),
	},
	handler: async (ctx, args) => {
		let created = 0;
		let updated = 0;

		for (const rel of args.relationships) {
			const existing = await ctx.db
				.query("code_relationships")
				.withIndex("by_source", (q) => q.eq("sourceFileId", rel.sourceFileId))
				.filter((q) =>
					q.and(
						q.eq(q.field("targetFileId"), rel.targetFileId),
						q.eq(q.field("type"), rel.type)
					)
				)
				.first();

			if (existing) {
				await ctx.db.patch(existing._id, {
					strength: rel.strength,
					evidence: rel.evidence,
					updatedAt: now(),
				});
				updated++;
			} else {
				await ctx.db.insert("code_relationships", {
					repoId: rel.repoId,
					sourceFileId: rel.sourceFileId,
					targetFileId: rel.targetFileId,
					type: rel.type,
					strength: rel.strength,
					evidence: rel.evidence,
					createdAt: now(),
					updatedAt: null,
				});
				created++;
			}
		}

		return { created, updated };
	},
});

/**
 * Delete a specific relationship
 */
export const deleteRelationship = mutation({
	args: {
		relationshipId: v.id("code_relationships"),
	},
	handler: async (ctx, args) => {
		await ctx.db.delete(args.relationshipId);
		return { success: true };
	},
});

// ============================================
// CODE FILE QUERIES
// ============================================

/**
 * Get a code file by path
 */
export const getFileByPath = query({
	args: {
		repoId: v.id("repositories"),
		filePath: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("code_files")
			.withIndex("by_repo_path", (q) =>
				q.eq("repoId", args.repoId).eq("filePath", args.filePath)
			)
			.first();
	},
});

/**
 * Get all code files for a repository
 */
export const getFilesForRepo = query({
	args: {
		repoId: v.id("repositories"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const query = ctx.db
			.query("code_files")
			.withIndex("by_repo", (q) => q.eq("repoId", args.repoId));

		if (args.limit) {
			return await query.take(args.limit);
		}
		return await query.collect();
	},
});

/**
 * Get high-risk files for a repository
 */
export const getHighRiskFiles = query({
	args: {
		repoId: v.id("repositories"),
		minRisk: v.optional(v.number()),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const minRisk = args.minRisk || 50;
		const limit = args.limit || 20;

		const files = await ctx.db
			.query("code_files")
			.withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
			.collect();

		return files
			.filter((f) => f.riskScore >= minRisk)
			.sort((a, b) => b.riskScore - a.riskScore)
			.slice(0, limit);
	},
});

// ============================================
// RELATIONSHIP QUERIES
// ============================================

/**
 * Get all relationships where file is the source
 */
export const getFileRelationships = query({
	args: {
		fileId: v.id("code_files"),
	},
	handler: async (ctx, args) => {
		const relationships = await ctx.db
			.query("code_relationships")
			.withIndex("by_source", (q) => q.eq("sourceFileId", args.fileId))
			.collect();

		// Fetch target file info
		const withTargets = await Promise.all(
			relationships.map(async (rel) => {
				const target = await ctx.db.get(rel.targetFileId);
				return {
					...rel,
					targetFile: target ? { path: target.filePath, riskScore: target.riskScore } : null,
				};
			})
		);

		return withTargets;
	},
});

/**
 * Get all files that depend on this file (reverse relationships)
 */
export const getFileDependents = query({
	args: {
		fileId: v.id("code_files"),
	},
	handler: async (ctx, args) => {
		const relationships = await ctx.db
			.query("code_relationships")
			.withIndex("by_target", (q) => q.eq("targetFileId", args.fileId))
			.collect();

		// Fetch source file info
		const withSources = await Promise.all(
			relationships.map(async (rel) => {
				const source = await ctx.db.get(rel.sourceFileId);
				return {
					...rel,
					sourceFile: source ? { path: source.filePath, riskScore: source.riskScore } : null,
				};
			})
		);

		return withSources;
	},
});

/**
 * Get co-changed files (files that historically change together)
 */
export const getCoChangedFiles = query({
	args: {
		fileId: v.id("code_files"),
		minStrength: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const minStrength = args.minStrength || 15;

		const relationships = await ctx.db
			.query("code_relationships")
			.withIndex("by_source", (q) => q.eq("sourceFileId", args.fileId))
			.filter((q) => q.eq(q.field("type"), "co_changes"))
			.collect();

		const filtered = relationships.filter((r) => r.strength >= minStrength);

		// Fetch target file info
		const withTargets = await Promise.all(
			filtered.map(async (rel) => {
				const target = await ctx.db.get(rel.targetFileId);
				return {
					...rel,
					targetFile: target ? { path: target.filePath, riskScore: target.riskScore } : null,
				};
			})
		);

		return withTargets.sort((a, b) => b.strength - a.strength);
	},
});

/**
 * Get import relationships for a file
 */
export const getFileImports = query({
	args: {
		fileId: v.id("code_files"),
	},
	handler: async (ctx, args) => {
		const relationships = await ctx.db
			.query("code_relationships")
			.withIndex("by_source", (q) => q.eq("sourceFileId", args.fileId))
			.filter((q) => q.eq(q.field("type"), "imports"))
			.collect();

		// Fetch target file info
		const withTargets = await Promise.all(
			relationships.map(async (rel) => {
				const target = await ctx.db.get(rel.targetFileId);
				return {
					...rel,
					targetFile: target ? { path: target.filePath, riskScore: target.riskScore } : null,
				};
			})
		);

		return withTargets;
	},
});

// ============================================
// MEMORY-FILE LINK MUTATIONS
// ============================================

/**
 * Link a memory to a code file
 */
export const linkMemoryToFile = mutation({
	args: {
		memoryId: v.id("memories"),
		codeFileId: v.id("code_files"),
		linkType: literals("applies_to", "mentions", "warns_about"),
	},
	handler: async (ctx, args) => {
		// Check if link already exists
		const existing = await ctx.db
			.query("memory_file_links")
			.withIndex("by_memory", (q) => q.eq("memoryId", args.memoryId))
			.filter((q) => q.eq(q.field("codeFileId"), args.codeFileId))
			.first();

		if (existing) {
			// Update link type if different
			if (existing.linkType !== args.linkType) {
				await ctx.db.patch(existing._id, { linkType: args.linkType });
			}
			return { linkId: existing._id, updated: true };
		}

		const linkId = await ctx.db.insert("memory_file_links", {
			memoryId: args.memoryId,
			codeFileId: args.codeFileId,
			linkType: args.linkType,
			createdAt: now(),
		});
		return { linkId, updated: false };
	},
});

/**
 * Remove a memory-file link
 */
export const unlinkMemoryFromFile = mutation({
	args: {
		memoryId: v.id("memories"),
		codeFileId: v.id("code_files"),
	},
	handler: async (ctx, args) => {
		const link = await ctx.db
			.query("memory_file_links")
			.withIndex("by_memory", (q) => q.eq("memoryId", args.memoryId))
			.filter((q) => q.eq(q.field("codeFileId"), args.codeFileId))
			.first();

		if (link) {
			await ctx.db.delete(link._id);
			return { success: true };
		}
		return { success: false };
	},
});

// ============================================
// MEMORY-FILE LINK QUERIES
// ============================================

/**
 * Get all file links for a memory
 */
export const getMemoryFileLinks = query({
	args: {
		memoryId: v.id("memories"),
	},
	handler: async (ctx, args) => {
		const links = await ctx.db
			.query("memory_file_links")
			.withIndex("by_memory", (q) => q.eq("memoryId", args.memoryId))
			.collect();

		// Fetch file info
		const withFiles = await Promise.all(
			links.map(async (link) => {
				const file = await ctx.db.get(link.codeFileId);
				return {
					...link,
					file: file ? { path: file.filePath, riskScore: file.riskScore } : null,
				};
			})
		);

		return withFiles;
	},
});

/**
 * Get all memories linked to a file
 */
export const getFileMemories = query({
	args: {
		codeFileId: v.id("code_files"),
	},
	handler: async (ctx, args) => {
		const links = await ctx.db
			.query("memory_file_links")
			.withIndex("by_file", (q) => q.eq("codeFileId", args.codeFileId))
			.collect();

		// Fetch memory info
		const withMemories = await Promise.all(
			links.map(async (link) => {
				const memory = await ctx.db.get(link.memoryId);
				return {
					...link,
					memory: memory
						? {
								context: memory.context,
								summary: memory.summary,
								importance: memory.importance,
								memoryType: memory.memoryType,
								tags: memory.tags,
						  }
						: null,
				};
			})
		);

		return withMemories.filter((m) => m.memory !== null);
	},
});

// ============================================
// GRAPH STATS
// ============================================

/**
 * Get code graph statistics for a repository
 */
export const getGraphStats = query({
	args: {
		repoId: v.id("repositories"),
	},
	handler: async (ctx, args) => {
		const files = await ctx.db
			.query("code_files")
			.withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
			.collect();

		const relationships = await ctx.db
			.query("code_relationships")
			.withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
			.collect();

		// Count by relationship type
		const byType = {
			imports: relationships.filter((r) => r.type === "imports").length,
			co_changes: relationships.filter((r) => r.type === "co_changes").length,
			tests: relationships.filter((r) => r.type === "tests").length,
			types: relationships.filter((r) => r.type === "types").length,
			transitive: relationships.filter((r) => r.type === "transitive").length,
		};

		// Risk distribution
		const byRisk = {
			critical: files.filter((f) => f.riskScore >= 75).length,
			high: files.filter((f) => f.riskScore >= 50 && f.riskScore < 75).length,
			medium: files.filter((f) => f.riskScore >= 25 && f.riskScore < 50).length,
			low: files.filter((f) => f.riskScore < 25).length,
		};

		// Language distribution
		const languages = new Map<string, number>();
		for (const file of files) {
			languages.set(file.language, (languages.get(file.language) || 0) + 1);
		}

		return {
			totalFiles: files.length,
			totalRelationships: relationships.length,
			byRelationType: byType,
			byRiskLevel: byRisk,
			byLanguage: Object.fromEntries(languages),
			avgRiskScore: files.length > 0
				? Math.round(files.reduce((sum, f) => sum + f.riskScore, 0) / files.length)
				: 0,
		};
	},
});
