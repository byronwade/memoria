import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const now = () => Date.now();

// Helper for creating union of literals (matches schema.ts)
const literals = <T extends string>(...values: T[]) =>
	v.union(...values.map((val) => v.literal(val))) as ReturnType<typeof v.literal<T>>;

/**
 * Create a new memory (human context for AI)
 * Enhanced with Tri-Layer Brain fields
 */
export const createMemory = mutation({
	args: {
		userId: v.id("users"),
		repoId: v.optional(v.id("repositories")), // null = user-wide
		context: v.string(),
		summary: v.optional(v.string()),
		tags: v.array(v.string()),
		keywords: v.optional(v.array(v.string())),
		linkedFiles: v.array(v.string()),
		memoryType: v.optional(
			literals("lesson", "context", "decision", "pattern", "warning", "todo"),
		),
		source: v.optional(
			v.object({
				type: literals("manual", "pr_comment", "commit_message", "auto_extracted"),
				reference: v.union(v.string(), v.null()),
			}),
		),
		importance: v.optional(literals("critical", "high", "normal", "low")),
		createdBy: v.id("users"),
	},
	handler: async (ctx, args) => {
		// Auto-extract keywords if not provided
		const keywords = args.keywords || extractKeywordsFromText(args.context);
		// Auto-generate summary if not provided (first 100 chars)
		const summary = args.summary || args.context.slice(0, 100) + (args.context.length > 100 ? "..." : "");

		const memoryId = await ctx.db.insert("memories", {
			userId: args.userId,
			repoId: args.repoId,
			context: args.context,
			summary,
			tags: args.tags,
			keywords,
			linkedFiles: args.linkedFiles,
			memoryType: args.memoryType || "context",
			source: args.source || { type: "manual", reference: null },
			importance: args.importance || "normal",
			accessCount: 0,
			lastAccessedAt: null,
			createdBy: args.createdBy,
			createdAt: now(),
			updatedAt: null,
		});
		return { memoryId };
	},
});

/**
 * Update an existing memory
 * Enhanced with Tri-Layer Brain fields
 */
export const updateMemory = mutation({
	args: {
		memoryId: v.id("memories"),
		context: v.optional(v.string()),
		summary: v.optional(v.string()),
		tags: v.optional(v.array(v.string())),
		keywords: v.optional(v.array(v.string())),
		linkedFiles: v.optional(v.array(v.string())),
		memoryType: v.optional(
			literals("lesson", "context", "decision", "pattern", "warning", "todo"),
		),
		importance: v.optional(literals("critical", "high", "normal", "low")),
	},
	handler: async (ctx, args) => {
		const { memoryId, ...updates } = args;

		const existing = await ctx.db.get(memoryId);
		if (!existing) {
			throw new Error("Memory not found");
		}

		const patch: Record<string, unknown> = { updatedAt: now() };
		if (updates.context !== undefined) {
			patch.context = updates.context;
			// Re-extract keywords if context changed
			patch.keywords = updates.keywords || extractKeywordsFromText(updates.context);
			// Update summary if context changed and no explicit summary
			if (!updates.summary) {
				patch.summary = updates.context.slice(0, 100) + (updates.context.length > 100 ? "..." : "");
			}
		}
		if (updates.summary !== undefined) patch.summary = updates.summary;
		if (updates.tags !== undefined) patch.tags = updates.tags;
		if (updates.keywords !== undefined) patch.keywords = updates.keywords;
		if (updates.linkedFiles !== undefined) patch.linkedFiles = updates.linkedFiles;
		if (updates.memoryType !== undefined) patch.memoryType = updates.memoryType;
		if (updates.importance !== undefined) patch.importance = updates.importance;

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
 * List all memories for a user (optionally filtered by repo)
 */
export const listMemories = query({
	args: {
		userId: v.id("users"),
		repoId: v.optional(v.id("repositories")),
		tag: v.optional(v.string()), // filter by tag
	},
	handler: async (ctx, args) => {
		let memories = await ctx.db
			.query("memories")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
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
 * This merges user-wide memories with repo-specific ones
 */
export const getMemoriesForRepo = query({
	args: {
		userId: v.id("users"),
		repoId: v.id("repositories"),
	},
	handler: async (ctx, args) => {
		const memories = await ctx.db
			.query("memories")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();

		// Filter to only memories that apply to this repo
		// (user-wide OR repo-specific)
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
 * Get all unique tags used in memories for a user
 */
export const getMemoryTags = query({
	args: {
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const memories = await ctx.db
			.query("memories")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
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
 * Get memory stats for a user
 */
export const getMemoryStats = query({
	args: {
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const memories = await ctx.db
			.query("memories")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();

		const userWide = memories.filter((m) => m.repoId === undefined);
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

		// Count by importance
		const byImportance = {
			critical: memories.filter((m) => m.importance === "critical").length,
			high: memories.filter((m) => m.importance === "high").length,
			normal: memories.filter((m) => m.importance === "normal" || !m.importance).length,
			low: memories.filter((m) => m.importance === "low").length,
		};

		// Count by type
		const byType = {
			lesson: memories.filter((m) => m.memoryType === "lesson").length,
			context: memories.filter((m) => m.memoryType === "context" || !m.memoryType).length,
			decision: memories.filter((m) => m.memoryType === "decision").length,
			pattern: memories.filter((m) => m.memoryType === "pattern").length,
			warning: memories.filter((m) => m.memoryType === "warning").length,
			todo: memories.filter((m) => m.memoryType === "todo").length,
		};

		return {
			total: memories.length,
			userWide: userWide.length,
			repoSpecific: repoSpecific.length,
			uniqueTags: tagSet.size,
			linkedFiles: fileSet.size,
			byImportance,
			byType,
		};
	},
});

// ============================================
// TRI-LAYER BRAIN: KEYWORD EXTRACTION
// ============================================

// Common English stopwords to filter out
const STOPWORDS = new Set([
	"a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
	"has", "he", "in", "is", "it", "its", "of", "on", "or", "she",
	"that", "the", "to", "was", "were", "will", "with", "this", "but",
	"they", "have", "had", "what", "when", "where", "who", "which",
	"why", "how", "all", "each", "every", "both", "few", "more", "most",
	"other", "some", "such", "no", "not", "only", "own", "same", "so",
	"than", "too", "very", "can", "just", "should", "now",
]);

/**
 * Extract keywords from text for BM25 matching
 * Runs in Convex runtime (no external dependencies)
 */
function extractKeywordsFromText(text: string): string[] {
	if (!text || typeof text !== "string") return [];

	const tokens = text
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((token) => {
			if (token.length < 2) return false;
			if (STOPWORDS.has(token)) return false;
			if (/^\d+$/.test(token) && token.length < 3) return false;
			return true;
		});

	// Basic stemming: remove common suffixes
	const stemmed = tokens.map((token) => {
		if (token.endsWith("ing") && token.length > 5) return token.slice(0, -3);
		if (token.endsWith("ed") && token.length > 4) return token.slice(0, -2);
		if (token.endsWith("es") && token.length > 4) return token.slice(0, -2);
		if (token.endsWith("s") && token.length > 3 && !token.endsWith("ss")) return token.slice(0, -1);
		return token;
	});

	return [...new Set(stemmed)];
}

// ============================================
// TRI-LAYER BRAIN: BM25 SEARCH FUNCTIONS
// ============================================

/**
 * Search memories using BM25 keyword matching
 * Returns scored results for AI to further process
 */
export const searchMemories = query({
	args: {
		userId: v.id("users"),
		repoId: v.optional(v.id("repositories")),
		queryKeywords: v.array(v.string()),
		limit: v.optional(v.number()),
		minImportance: v.optional(literals("critical", "high", "normal", "low")),
	},
	handler: async (ctx, args) => {
		const limit = args.limit || 20;

		// Get all memories for the user
		let memories = await ctx.db
			.query("memories")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();

		// Filter by repo if specified
		if (args.repoId !== undefined) {
			memories = memories.filter(
				(m) => m.repoId === args.repoId || m.repoId === undefined
			);
		}

		// Filter by minimum importance
		if (args.minImportance) {
			const importanceOrder = { critical: 4, high: 3, normal: 2, low: 1 };
			const minLevel = importanceOrder[args.minImportance];
			memories = memories.filter((m) => {
				const memLevel = importanceOrder[m.importance || "normal"];
				return memLevel >= minLevel;
			});
		}

		if (args.queryKeywords.length === 0) {
			// No keywords - return by importance/recency
			return memories
				.sort((a, b) => {
					const importanceOrder = { critical: 4, high: 3, normal: 2, low: 1 };
					const aImport = importanceOrder[a.importance || "normal"];
					const bImport = importanceOrder[b.importance || "normal"];
					if (aImport !== bImport) return bImport - aImport;
					return b.createdAt - a.createdAt;
				})
				.slice(0, limit)
				.map((m) => ({ ...m, score: 0, matchedTerms: [] }));
		}

		// BM25 scoring
		const scored = bm25Search(
			memories,
			(m) => m.keywords || extractKeywordsFromText(m.context),
			args.queryKeywords,
		);

		// Increment access count for returned memories
		const topResults = scored.slice(0, limit);
		for (const result of topResults) {
			// Note: Can't do mutations in queries - would need separate mutation
		}

		return topResults;
	},
});

/**
 * Get memories for a specific file path
 * Uses linkedFiles and keyword matching
 */
export const getMemoriesForFile = query({
	args: {
		userId: v.id("users"),
		repoId: v.optional(v.id("repositories")),
		filePath: v.string(),
	},
	handler: async (ctx, args) => {
		// Get all memories for the user
		let memories = await ctx.db
			.query("memories")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();

		// Filter by repo if specified
		if (args.repoId !== undefined) {
			memories = memories.filter(
				(m) => m.repoId === args.repoId || m.repoId === undefined
			);
		}

		// Extract keywords from file path
		const fileKeywords = extractFilePathKeywords(args.filePath);

		// Score each memory
		const scored: Array<typeof memories[0] & { score: number; matchReason: string }> = [];

		for (const memory of memories) {
			let score = 0;
			let matchReason = "";

			// Direct file link (highest priority)
			if (memory.linkedFiles.some((f) => args.filePath.includes(f) || f.includes(args.filePath))) {
				score += 100;
				matchReason = "linked";
			}

			// Keyword match with file path
			const memKeywords = memory.keywords || extractKeywordsFromText(memory.context);
			const matchedKeywords = fileKeywords.filter((k) => memKeywords.includes(k));
			if (matchedKeywords.length > 0) {
				score += matchedKeywords.length * 10;
				matchReason = matchReason || `keywords: ${matchedKeywords.join(", ")}`;
			}

			// Importance boost
			const importanceBoost = { critical: 50, high: 25, normal: 0, low: -10 };
			score += importanceBoost[memory.importance || "normal"];

			if (score > 0) {
				scored.push({ ...memory, score, matchReason });
			}
		}

		// Sort by score and return
		return scored.sort((a, b) => b.score - a.score);
	},
});

/**
 * Increment access count for a memory (call when memory is used)
 */
export const incrementAccessCount = mutation({
	args: {
		memoryId: v.id("memories"),
	},
	handler: async (ctx, args) => {
		const memory = await ctx.db.get(args.memoryId);
		if (!memory) return { success: false };

		await ctx.db.patch(args.memoryId, {
			accessCount: (memory.accessCount || 0) + 1,
			lastAccessedAt: now(),
		});
		return { success: true };
	},
});

/**
 * Get critical/high importance memories (for AI pre-flight checks)
 */
export const getCriticalMemories = query({
	args: {
		userId: v.id("users"),
		repoId: v.optional(v.id("repositories")),
	},
	handler: async (ctx, args) => {
		let memories = await ctx.db
			.query("memories")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();

		// Filter by repo
		if (args.repoId !== undefined) {
			memories = memories.filter(
				(m) => m.repoId === args.repoId || m.repoId === undefined
			);
		}

		// Filter to critical/high importance
		return memories
			.filter((m) => m.importance === "critical" || m.importance === "high")
			.sort((a, b) => {
				// Critical first, then high
				if (a.importance === "critical" && b.importance !== "critical") return -1;
				if (b.importance === "critical" && a.importance !== "critical") return 1;
				return b.createdAt - a.createdAt;
			});
	},
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract keywords from a file path
 */
function extractFilePathKeywords(filePath: string): string[] {
	// Remove common extensions
	const withoutExt = filePath.replace(
		/\.(ts|tsx|js|jsx|py|go|rs|java|rb|php|vue|svelte|astro|md|json|yaml|yml|css|scss|less|html)$/i,
		"",
	);

	// Split on path separators, dots, underscores, hyphens
	const segments = withoutExt.split(/[/\\._-]+/);
	const keywords: string[] = [];

	for (const segment of segments) {
		if (segment.length < 2) continue;
		if (["src", "lib", "dist", "node_modules", "index", "main"].includes(segment)) continue;

		// Split camelCase and PascalCase
		const parts = segment
			.replace(/([a-z])([A-Z])/g, "$1 $2")
			.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
			.toLowerCase()
			.split(/\s+/);

		for (const part of parts) {
			if (part.length >= 2 && !STOPWORDS.has(part)) {
				keywords.push(part);
			}
		}
	}

	return [...new Set(keywords)];
}

/**
 * Simple BM25 search implementation
 * Runs entirely in Convex (no external deps)
 */
function bm25Search<T>(
	documents: T[],
	getKeywords: (doc: T) => string[],
	queryKeywords: string[],
): Array<T & { score: number; matchedTerms: string[] }> {
	if (documents.length === 0 || queryKeywords.length === 0) return [];

	const k1 = 1.2;
	const b = 0.75;

	// Build document frequency map
	const docFreq = new Map<string, number>();
	let totalLength = 0;

	const docKeywordsMap = new Map<T, string[]>();
	for (const doc of documents) {
		const keywords = getKeywords(doc);
		docKeywordsMap.set(doc, keywords);
		totalLength += keywords.length;
		const unique = new Set(keywords);
		for (const term of unique) {
			docFreq.set(term, (docFreq.get(term) || 0) + 1);
		}
	}

	const avgDocLength = totalLength / documents.length;

	// Score each document
	const results: Array<T & { score: number; matchedTerms: string[] }> = [];

	for (const doc of documents) {
		const keywords = docKeywordsMap.get(doc) || [];
		const docLength = keywords.length;
		const matchedTerms: string[] = [];

		// Term frequency in document
		const termFreq = new Map<string, number>();
		for (const term of keywords) {
			termFreq.set(term, (termFreq.get(term) || 0) + 1);
		}

		let score = 0;
		for (const queryTerm of queryKeywords) {
			const tf = termFreq.get(queryTerm) || 0;
			if (tf === 0) continue;

			matchedTerms.push(queryTerm);

			const df = docFreq.get(queryTerm) || 0;
			const idf = Math.log((documents.length - df + 0.5) / (df + 0.5) + 1);
			const numerator = tf * (k1 + 1);
			const denominator = tf + k1 * (1 - b + (b * docLength) / avgDocLength);
			score += idf * (numerator / denominator);
		}

		if (score > 0) {
			results.push({ ...doc, score, matchedTerms });
		}
	}

	return results.sort((a, b) => b.score - a.score);
}
