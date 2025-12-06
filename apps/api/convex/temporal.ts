import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const now = () => Date.now();

// Helper for creating union of literals (matches schema.ts)
const literals = <T extends string>(...values: T[]) =>
	v.union(...values.map((val) => v.literal(val))) as ReturnType<typeof v.literal<T>>;

// ============================================
// PANIC KEYWORDS (for commit classification)
// ============================================

// Weighted keywords for panic score calculation
const PANIC_KEYWORDS: Record<string, number> = {
	// Critical (weight 3)
	security: 3,
	vulnerability: 3,
	crash: 3,
	"data loss": 3,
	exploit: 3,
	breach: 3,
	injection: 3,
	xss: 3,
	csrf: 3,

	// High (weight 2)
	revert: 2,
	hotfix: 2,
	urgent: 2,
	breaking: 2,
	critical: 2,
	emergency: 2,
	rollback: 2,
	downtime: 2,
	outage: 2,

	// Normal (weight 1)
	fix: 1,
	bug: 1,
	patch: 1,
	error: 1,
	issue: 1,
	problem: 1,
	broken: 1,
	failed: 1,
	wrong: 1,

	// Low/positive (weight 0.5 or less)
	refactor: 0.5,
	cleanup: 0.5,
	lint: 0.3,
	format: 0.3,
	typo: 0.3,
	docs: 0.2,
	comment: 0.2,
};

// Commit type detection patterns
const COMMIT_TYPE_PATTERNS: Array<{ pattern: RegExp; type: "bugfix" | "feature" | "refactor" | "docs" | "chore" }> = [
	{ pattern: /^fix(\(|:|\s)|bug|patch|hotfix|revert/i, type: "bugfix" },
	{ pattern: /^feat(\(|:|\s)|feature|add|implement|new/i, type: "feature" },
	{ pattern: /^refactor(\(|:|\s)|refactor|clean|restructure/i, type: "refactor" },
	{ pattern: /^docs?(\(|:|\s)|documentation|readme|changelog/i, type: "docs" },
	{ pattern: /^chore(\(|:|\s)|^ci(\(|:|\s)|^build(\(|:|\s)|deps?|upgrade|update/i, type: "chore" },
];

// ============================================
// COMMIT INDEX MUTATIONS
// ============================================

/**
 * Index a single commit
 */
export const indexCommit = mutation({
	args: {
		repoId: v.id("repositories"),
		commitHash: v.string(),
		message: v.string(),
		authorEmail: v.string(),
		authorName: v.string(),
		committedAt: v.number(),
		filesChanged: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		// Check if already indexed
		const existing = await ctx.db
			.query("commit_index")
			.withIndex("by_repo_hash", (q) =>
				q.eq("repoId", args.repoId).eq("commitHash", args.commitHash)
			)
			.first();

		if (existing) {
			return { commitId: existing._id, alreadyIndexed: true };
		}

		// Calculate panic score
		const panicScore = calculatePanicScore(args.message);

		// Detect commit type
		const commitType = detectCommitType(args.message);

		// Extract keywords
		const keywords = extractCommitKeywords(args.message);

		const commitId = await ctx.db.insert("commit_index", {
			repoId: args.repoId,
			commitHash: args.commitHash,
			message: args.message,
			authorEmail: args.authorEmail,
			authorName: args.authorName,
			committedAt: args.committedAt,
			commitType,
			panicScore,
			keywords,
			filesChanged: args.filesChanged,
			createdAt: now(),
		});

		return { commitId, alreadyIndexed: false };
	},
});

/**
 * Batch index multiple commits
 */
export const batchIndexCommits = mutation({
	args: {
		commits: v.array(
			v.object({
				repoId: v.id("repositories"),
				commitHash: v.string(),
				message: v.string(),
				authorEmail: v.string(),
				authorName: v.string(),
				committedAt: v.number(),
				filesChanged: v.array(v.string()),
			}),
		),
	},
	handler: async (ctx, args) => {
		let indexed = 0;
		let skipped = 0;

		for (const commit of args.commits) {
			const existing = await ctx.db
				.query("commit_index")
				.withIndex("by_repo_hash", (q) =>
					q.eq("repoId", commit.repoId).eq("commitHash", commit.commitHash)
				)
				.first();

			if (existing) {
				skipped++;
				continue;
			}

			const panicScore = calculatePanicScore(commit.message);
			const commitType = detectCommitType(commit.message);
			const keywords = extractCommitKeywords(commit.message);

			await ctx.db.insert("commit_index", {
				repoId: commit.repoId,
				commitHash: commit.commitHash,
				message: commit.message,
				authorEmail: commit.authorEmail,
				authorName: commit.authorName,
				committedAt: commit.committedAt,
				commitType,
				panicScore,
				keywords,
				filesChanged: commit.filesChanged,
				createdAt: now(),
			});
			indexed++;
		}

		return { indexed, skipped };
	},
});

/**
 * Delete old commits beyond retention window
 */
export const pruneOldCommits = mutation({
	args: {
		repoId: v.id("repositories"),
		olderThanDays: v.number(),
	},
	handler: async (ctx, args) => {
		const cutoffTime = now() - args.olderThanDays * 24 * 60 * 60 * 1000;

		const oldCommits = await ctx.db
			.query("commit_index")
			.withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
			.filter((q) => q.lt(q.field("committedAt"), cutoffTime))
			.collect();

		for (const commit of oldCommits) {
			await ctx.db.delete(commit._id);
		}

		return { deleted: oldCommits.length };
	},
});

// ============================================
// COMMIT INDEX QUERIES
// ============================================

/**
 * Get recent commits for a repository
 */
export const getRecentCommits = query({
	args: {
		repoId: v.id("repositories"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit || 50;

		const commits = await ctx.db
			.query("commit_index")
			.withIndex("by_repo_date", (q) => q.eq("repoId", args.repoId))
			.order("desc")
			.take(limit);

		return commits;
	},
});

/**
 * Get commits that touched a specific file
 */
export const getCommitsForFile = query({
	args: {
		repoId: v.id("repositories"),
		filePath: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit || 20;

		// Get all commits and filter by file
		// Note: In production, you'd want a more efficient index for this
		const allCommits = await ctx.db
			.query("commit_index")
			.withIndex("by_repo_date", (q) => q.eq("repoId", args.repoId))
			.order("desc")
			.collect();

		const matching = allCommits
			.filter((c) => c.filesChanged.some((f) => f.includes(args.filePath) || args.filePath.includes(f)))
			.slice(0, limit);

		return matching;
	},
});

/**
 * Get high-panic commits (potential bug fixes, reverts, etc.)
 */
export const getHighPanicCommits = query({
	args: {
		repoId: v.id("repositories"),
		minPanicScore: v.optional(v.number()),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const minScore = args.minPanicScore || 50;
		const limit = args.limit || 20;

		const commits = await ctx.db
			.query("commit_index")
			.withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
			.collect();

		return commits
			.filter((c) => c.panicScore >= minScore)
			.sort((a, b) => b.panicScore - a.panicScore)
			.slice(0, limit);
	},
});

/**
 * Search commits by keywords
 */
export const searchCommits = query({
	args: {
		repoId: v.id("repositories"),
		queryKeywords: v.array(v.string()),
		commitType: v.optional(literals("bugfix", "feature", "refactor", "docs", "chore", "unknown")),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit || 20;

		let commits = await ctx.db
			.query("commit_index")
			.withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
			.collect();

		// Filter by commit type if specified
		if (args.commitType) {
			commits = commits.filter((c) => c.commitType === args.commitType);
		}

		if (args.queryKeywords.length === 0) {
			return commits.sort((a, b) => b.committedAt - a.committedAt).slice(0, limit);
		}

		// Simple keyword matching (BM25 would be overkill for commit messages)
		const scored = commits.map((commit) => {
			let score = 0;
			const matchedKeywords: string[] = [];

			for (const queryKeyword of args.queryKeywords) {
				const lowerQuery = queryKeyword.toLowerCase();
				// Check keywords array
				if (commit.keywords.some((k) => k.includes(lowerQuery) || lowerQuery.includes(k))) {
					score += 2;
					matchedKeywords.push(queryKeyword);
				}
				// Check message directly
				else if (commit.message.toLowerCase().includes(lowerQuery)) {
					score += 1;
					matchedKeywords.push(queryKeyword);
				}
			}

			return { ...commit, score, matchedKeywords };
		});

		return scored
			.filter((c) => c.score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, limit);
	},
});

/**
 * Get commit statistics for a repository
 */
export const getCommitStats = query({
	args: {
		repoId: v.id("repositories"),
		sinceDays: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const sinceDays = args.sinceDays || 30;
		const sinceTime = now() - sinceDays * 24 * 60 * 60 * 1000;

		const commits = await ctx.db
			.query("commit_index")
			.withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
			.filter((q) => q.gte(q.field("committedAt"), sinceTime))
			.collect();

		// Count by type
		const byType = {
			bugfix: commits.filter((c) => c.commitType === "bugfix").length,
			feature: commits.filter((c) => c.commitType === "feature").length,
			refactor: commits.filter((c) => c.commitType === "refactor").length,
			docs: commits.filter((c) => c.commitType === "docs").length,
			chore: commits.filter((c) => c.commitType === "chore").length,
			unknown: commits.filter((c) => c.commitType === "unknown").length,
		};

		// Panic score distribution
		const byPanic = {
			critical: commits.filter((c) => c.panicScore >= 75).length,
			high: commits.filter((c) => c.panicScore >= 50 && c.panicScore < 75).length,
			medium: commits.filter((c) => c.panicScore >= 25 && c.panicScore < 50).length,
			low: commits.filter((c) => c.panicScore < 25).length,
		};

		// Top authors
		const authorCounts = new Map<string, number>();
		for (const commit of commits) {
			const key = commit.authorEmail;
			authorCounts.set(key, (authorCounts.get(key) || 0) + 1);
		}
		const topAuthors = Array.from(authorCounts.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([email, count]) => ({ email, count }));

		return {
			totalCommits: commits.length,
			periodDays: sinceDays,
			byType,
			byPanic,
			topAuthors,
			avgPanicScore: commits.length > 0
				? Math.round(commits.reduce((sum, c) => sum + c.panicScore, 0) / commits.length)
				: 0,
		};
	},
});

/**
 * Get velocity metrics (commits per day/week)
 */
export const getVelocityMetrics = query({
	args: {
		repoId: v.id("repositories"),
	},
	handler: async (ctx, args) => {
		const thirtyDaysAgo = now() - 30 * 24 * 60 * 60 * 1000;
		const sevenDaysAgo = now() - 7 * 24 * 60 * 60 * 1000;

		const last30Days = await ctx.db
			.query("commit_index")
			.withIndex("by_repo", (q) => q.eq("repoId", args.repoId))
			.filter((q) => q.gte(q.field("committedAt"), thirtyDaysAgo))
			.collect();

		const last7Days = last30Days.filter((c) => c.committedAt >= sevenDaysAgo);

		return {
			commitsLast7Days: last7Days.length,
			commitsLast30Days: last30Days.length,
			avgPerDay7: Math.round((last7Days.length / 7) * 10) / 10,
			avgPerDay30: Math.round((last30Days.length / 30) * 10) / 10,
			avgPerWeek: Math.round((last30Days.length / 4.3) * 10) / 10,
			velocityLevel: getVelocityLevel(last30Days.length / 4.3),
		};
	},
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate panic score based on commit message keywords
 */
function calculatePanicScore(message: string): number {
	const lowerMessage = message.toLowerCase();
	let totalWeight = 0;
	let matchCount = 0;

	for (const [keyword, weight] of Object.entries(PANIC_KEYWORDS)) {
		if (lowerMessage.includes(keyword)) {
			totalWeight += weight;
			matchCount++;
		}
	}

	if (matchCount === 0) return 0;

	// Normalize to 0-100 scale
	// Max theoretical score with all critical keywords would be around 30
	const normalized = Math.min(100, (totalWeight / 10) * 100);
	return Math.round(normalized);
}

/**
 * Detect commit type from message
 */
function detectCommitType(message: string): "bugfix" | "feature" | "refactor" | "docs" | "chore" | "unknown" {
	for (const { pattern, type } of COMMIT_TYPE_PATTERNS) {
		if (pattern.test(message)) {
			return type;
		}
	}
	return "unknown";
}

/**
 * Extract keywords from commit message
 */
function extractCommitKeywords(message: string): string[] {
	// Common stopwords
	const stopwords = new Set([
		"a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
		"of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
		"be", "have", "has", "had", "do", "does", "did", "will", "would", "could",
		"should", "may", "might", "must", "shall", "can", "need", "this", "that",
		"these", "those", "i", "you", "he", "she", "it", "we", "they", "what",
		"which", "who", "when", "where", "why", "how", "all", "each", "every",
	]);

	const tokens = message
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.split(/\s+/)
		.filter((t) => t.length >= 2 && !stopwords.has(t));

	return [...new Set(tokens)].slice(0, 20); // Limit keywords
}

/**
 * Classify velocity level
 */
function getVelocityLevel(commitsPerWeek: number): "low" | "normal" | "high" | "very_high" {
	if (commitsPerWeek < 5) return "low";
	if (commitsPerWeek < 20) return "normal";
	if (commitsPerWeek < 50) return "high";
	return "very_high";
}
