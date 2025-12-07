import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const now = () => Date.now();

// Helper for creating union of literals
const literals = <T extends string>(...values: T[]) =>
	v.union(...values.map((val) => v.literal(val))) as ReturnType<typeof v.literal<T>>;

const providerTypeValidator = literals("github", "gitlab", "bitbucket", "other");
const accountTypeValidator = literals("user", "org");
const installationStatusValidator = literals("active", "suspended", "deleted");
const prStateValidator = literals("open", "closed", "merged");
const engagementTypeValidator = literals("comment", "review", "approval", "request_changes");
const syncStatusValidator = literals("ok", "error", "pending");

export const upsertInstallation = mutation({
	args: {
		providerType: providerTypeValidator,
		providerInstallationId: v.string(),
		userId: v.string(), // Accept string, will be normalized
		accountType: accountTypeValidator,
		accountLogin: v.string(),
		accountName: v.union(v.string(), v.null()),
		permissions: v.union(v.any(), v.null()),
		status: installationStatusValidator,
	},
	handler: async (ctx, args) => {
		// Normalize userId
		const userId = ctx.db.normalizeId("users", args.userId);
		if (!userId) {
			throw new Error("Invalid user ID");
		}

		const existing = await ctx.db
			.query("scm_installations")
			.withIndex("by_providerInstallation", (q) =>
				q.eq("providerType", args.providerType).eq("providerInstallationId", args.providerInstallationId),
			)
			.first();

		const data = {
			providerType: args.providerType,
			providerInstallationId: args.providerInstallationId,
			userId,
			accountType: args.accountType,
			accountLogin: args.accountLogin,
			accountName: args.accountName,
			permissions: args.permissions,
			status: args.status,
		};

		if (existing) {
			await ctx.db.patch(existing._id, { ...data, updatedAt: now() });
			return { installationId: existing._id };
		}

		const installationId = await ctx.db.insert("scm_installations", {
			...data,
			lastSyncedAt: null,
			createdAt: now(),
			updatedAt: null,
		});
		return { installationId };
	},
});

export const upsertRepository = mutation({
	args: {
		userId: v.string(), // Accept string, will be normalized
		scmInstallationId: v.string(), // Accept string, will be normalized
		providerType: providerTypeValidator,
		providerRepoId: v.string(),
		fullName: v.string(),
		defaultBranch: v.string(),
		isPrivate: v.boolean(),
		isActive: v.boolean(),
		languageHint: v.union(v.string(), v.null()),
		settings: v.union(v.any(), v.null()),
	},
	handler: async (ctx, args) => {
		// Normalize IDs
		const userId = ctx.db.normalizeId("users", args.userId);
		const scmInstallationId = ctx.db.normalizeId("scm_installations", args.scmInstallationId);
		if (!userId || !scmInstallationId) {
			throw new Error("Invalid user or installation ID");
		}

		const existing = await ctx.db
			.query("repositories")
			.withIndex("by_provider_repo", (q) =>
				q.eq("providerType", args.providerType).eq("providerRepoId", args.providerRepoId),
			)
			.first();

		const data = {
			userId,
			scmInstallationId,
			providerType: args.providerType,
			providerRepoId: args.providerRepoId,
			fullName: args.fullName,
			defaultBranch: args.defaultBranch,
			isPrivate: args.isPrivate,
			isActive: args.isActive,
			languageHint: args.languageHint,
			settings: args.settings,
		};

		if (existing) {
			await ctx.db.patch(existing._id, { ...data, updatedAt: now() });
			return { repoId: existing._id };
		}

		const repoId = await ctx.db.insert("repositories", {
			...data,
			lastAnalyzedAt: null,
			createdAt: now(),
			updatedAt: null,
		});
		await ctx.db.insert("repository_sync_state", {
			repoId,
			lastFullCloneAt: null,
			lastFetchAt: null,
			lastSyncStatus: "pending",
			lastSyncErrorMessage: null,
			createdAt: now(),
			updatedAt: null,
		});
		return { repoId };
	},
});

export const upsertPullRequest = mutation({
	args: {
		repoId: v.id("repositories"),
		providerType: providerTypeValidator,
		providerPullRequestId: v.string(),
		number: v.number(),
		title: v.string(),
		body: v.union(v.string(), v.null()),
		state: prStateValidator,
		isDraft: v.boolean(),
		authorProviderUserId: v.string(),
		authorLogin: v.string(),
		sourceBranch: v.string(),
		targetBranch: v.string(),
		createdAtProvider: v.number(),
		updatedAtProvider: v.union(v.number(), v.null()),
		mergedAtProvider: v.union(v.number(), v.null()),
		closedAtProvider: v.union(v.number(), v.null()),
		labels: v.array(v.string()),
		metadata: v.union(v.any(), v.null()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("pull_requests")
			.withIndex("by_providerId", (q) =>
				q.eq("providerType", args.providerType).eq("providerPullRequestId", args.providerPullRequestId),
			)
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, { ...args });
			return { pullRequestId: existing._id };
		}

		const pullRequestId = await ctx.db.insert("pull_requests", {
			...args,
			lastAnalyzedAt: null,
			lastAnalysisId: undefined,
		});
		return { pullRequestId };
	},
});

export const addCommitMetadata = mutation({
	args: {
		repoId: v.id("repositories"),
		providerType: providerTypeValidator,
		providerCommitSha: v.string(),
		authorName: v.string(),
		authorEmail: v.string(),
		message: v.string(),
		committedAt: v.number(),
		metadata: v.union(v.any(), v.null()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("commits")
			.withIndex("by_repo_sha", (q) => q.eq("repoId", args.repoId).eq("providerCommitSha", args.providerCommitSha))
			.first();
		if (existing) return { commitId: existing._id };

		const commitId = await ctx.db.insert("commits", args);
		return { commitId };
	},
});

export const recordEngagement = mutation({
	args: {
		pullRequestId: v.id("pull_requests"),
		providerType: providerTypeValidator,
		type: engagementTypeValidator,
		providerEventId: v.string(),
		actorProviderUserId: v.string(),
		actorLogin: v.string(),
		body: v.union(v.string(), v.null()),
		createdAtProvider: v.number(),
		metadata: v.union(v.any(), v.null()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("pull_request_engagement")
			.withIndex("by_providerEvent", (q) =>
				q.eq("providerType", args.providerType).eq("providerEventId", args.providerEventId),
			)
			.first();
		if (existing) return { engagementId: existing._id };

		const engagementId = await ctx.db.insert("pull_request_engagement", args);
		return { engagementId };
	},
});

export const listPullRequests = query({
	args: { repoId: v.id("repositories"), state: v.optional(prStateValidator) },
	handler: async (ctx, args) => {
		let q = ctx.db.query("pull_requests").withIndex("by_repo_state", (idx) => idx.eq("repoId", args.repoId));
		if (args.state) {
			q = q.filter((filter) => filter.eq(filter.field("state"), args.state!));
		}
		return q.collect();
	},
});

export const getInstallationByProviderId = query({
	args: {
		providerType: providerTypeValidator,
		providerInstallationId: v.string(),
	},
	handler: async (ctx, args) => {
		return ctx.db
			.query("scm_installations")
			.withIndex("by_providerInstallation", (q) =>
				q.eq("providerType", args.providerType).eq("providerInstallationId", args.providerInstallationId),
			)
			.first();
	},
});

export const getRepositoryByProviderId = query({
	args: {
		providerType: providerTypeValidator,
		providerRepoId: v.string(),
	},
	handler: async (ctx, args) => {
		return ctx.db
			.query("repositories")
			.withIndex("by_provider_repo", (q) =>
				q.eq("providerType", args.providerType).eq("providerRepoId", args.providerRepoId),
			)
			.first();
	},
});

export const getRepository = query({
	args: { repoId: v.string() },
	handler: async (ctx, args) => {
		const repoId = ctx.db.normalizeId("repositories", args.repoId);
		if (!repoId) return null;
		return ctx.db.get(repoId);
	},
});

export const getPullRequest = query({
	args: { pullRequestId: v.id("pull_requests") },
	handler: async (ctx, args) => ctx.db.get(args.pullRequestId),
});

export const updateSyncState = mutation({
	args: {
		repoId: v.id("repositories"),
		lastFullCloneAt: v.optional(v.number()),
		lastFetchAt: v.optional(v.number()),
		lastSyncStatus: v.optional(syncStatusValidator),
		lastSyncErrorMessage: v.optional(v.union(v.string(), v.null())),
	},
	handler: async (ctx, args) => {
		const sync = await ctx.db
			.query("repository_sync_state")
			.withIndex("by_repoId", (q) => q.eq("repoId", args.repoId))
			.first();
		if (!sync) throw new Error("Sync state missing");

		const patch: Record<string, unknown> = { updatedAt: now() };
		if (args.lastFullCloneAt !== undefined) patch.lastFullCloneAt = args.lastFullCloneAt;
		if (args.lastFetchAt !== undefined) patch.lastFetchAt = args.lastFetchAt;
		if (args.lastSyncStatus) patch.lastSyncStatus = args.lastSyncStatus;
		if (args.lastSyncErrorMessage !== undefined) patch.lastSyncErrorMessage = args.lastSyncErrorMessage;
		await ctx.db.patch(sync._id, patch);
		return { repoId: args.repoId };
	},
});

export const getInstallations = query({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		const userId = ctx.db.normalizeId("users", args.userId);
		if (!userId) return [];
		return ctx.db
			.query("scm_installations")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.collect();
	},
});

export const getInstallationById = query({
	args: { installationId: v.string() },
	handler: async (ctx, args) => {
		const installationId = ctx.db.normalizeId("scm_installations", args.installationId);
		if (!installationId) return null;
		return ctx.db.get(installationId);
	},
});

export const getRepositories = query({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		const userId = ctx.db.normalizeId("users", args.userId);
		if (!userId) return [];
		return ctx.db
			.query("repositories")
			.withIndex("by_userId", (q) => q.eq("userId", userId))
			.collect();
	},
});

export const setRepositoryActive = mutation({
	args: {
		repoId: v.id("repositories"),
		isActive: v.boolean(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.repoId, {
			isActive: args.isActive,
			updatedAt: now(),
		});
		return { success: true };
	},
});

export const deactivateRepository = mutation({
	args: { repoId: v.id("repositories") },
	handler: async (ctx, args) => {
		await ctx.db.patch(args.repoId, {
			isActive: false,
			updatedAt: now(),
		});
		return { success: true };
	},
});

export const updateInstallationStatus = mutation({
	args: {
		providerType: providerTypeValidator,
		providerInstallationId: v.string(),
		status: installationStatusValidator,
	},
	handler: async (ctx, args) => {
		const installation = await ctx.db
			.query("scm_installations")
			.withIndex("by_providerInstallation", (q) =>
				q.eq("providerType", args.providerType).eq("providerInstallationId", args.providerInstallationId),
			)
			.first();

		if (!installation) {
			return { success: false, error: "Installation not found" };
		}

		await ctx.db.patch(installation._id, {
			status: args.status,
			updatedAt: now(),
		});

		return { success: true };
	},
});

// ============ REPOSITORY STATISTICS QUERIES ============

/**
 * Get comprehensive repository statistics for the detail page
 */
export const getRepositoryStats = query({
	args: { repoId: v.string() },
	handler: async (ctx, args) => {
		const repoId = ctx.db.normalizeId("repositories", args.repoId);
		if (!repoId) return null;

		const repo = await ctx.db.get(repoId);
		if (!repo) return null;

		// Get all analyses for this repo
		const analyses = await ctx.db
			.query("analyses")
			.withIndex("by_repo", (q) => q.eq("repoId", repoId))
			.collect();

		// Calculate stats from analyses
		const totalAnalyses = analyses.length;
		const highRiskAnalyses = analyses.filter(a => a.riskLevel === "high").length;
		const mediumRiskAnalyses = analyses.filter(a => a.riskLevel === "medium").length;
		const lowRiskAnalyses = analyses.filter(a => a.riskLevel === "low").length;

		// Issues prevented = high risk analyses that had comments posted
		const issuesPrevented = analyses.filter(a => a.riskLevel === "high" && a.commentPosted).length;

		// Average risk score
		const scoresWithValues = analyses.filter(a => a.score !== null).map(a => a.score as number);
		const avgRiskScore = scoresWithValues.length > 0
			? Math.round(scoresWithValues.reduce((a, b) => a + b, 0) / scoresWithValues.length)
			: 0;

		// Get file risk stats
		const fileRiskStats = await ctx.db
			.query("file_risk_stats")
			.withIndex("by_repo_highRisk", (q) => q.eq("repoId", repoId))
			.collect();

		const criticalFiles = fileRiskStats.filter(f => f.highRiskCount >= 3).length;
		const highRiskFiles = fileRiskStats.filter(f => f.highRiskCount >= 1 && f.highRiskCount < 3).length;
		const mediumRiskFiles = fileRiskStats.filter(f => f.mediumRiskCount >= 2 && f.highRiskCount === 0).length;
		const lowRiskFiles = fileRiskStats.filter(f => f.highRiskCount === 0 && f.mediumRiskCount < 2).length;

		// Calculate health score based on risk distribution
		const totalFiles = fileRiskStats.length || 1;
		const healthScore = Math.max(0, Math.min(100, Math.round(
			100 - (criticalFiles * 20 + highRiskFiles * 10 + mediumRiskFiles * 3) / totalFiles * 10
		)));

		// Determine trend from recent analyses
		const nowMs = Date.now();
		const thirtyDaysAgo = nowMs - 30 * 24 * 60 * 60 * 1000;
		const sixtyDaysAgo = nowMs - 60 * 24 * 60 * 60 * 1000;

		const recentAnalyses = analyses.filter(a => a.createdAt >= thirtyDaysAgo);
		const olderAnalyses = analyses.filter(a => a.createdAt >= sixtyDaysAgo && a.createdAt < thirtyDaysAgo);

		const recentAvg = recentAnalyses.length > 0
			? recentAnalyses.filter(a => a.score !== null).reduce((sum, a) => sum + (a.score || 0), 0) / recentAnalyses.length
			: 0;
		const olderAvg = olderAnalyses.length > 0
			? olderAnalyses.filter(a => a.score !== null).reduce((sum, a) => sum + (a.score || 0), 0) / olderAnalyses.length
			: 0;

		let trend: "up" | "down" | "stable" = "stable";
		if (recentAvg < olderAvg - 5) trend = "up"; // Lower risk = improving
		if (recentAvg > olderAvg + 5) trend = "down"; // Higher risk = declining

		return {
			totalAnalyses,
			issuesPrevented,
			avgRiskScore,
			healthScore,
			trend,
			riskDistribution: {
				critical: criticalFiles,
				high: highRiskFiles,
				medium: mediumRiskFiles,
				low: lowRiskFiles,
			},
			analysisBreakdown: {
				high: highRiskAnalyses,
				medium: mediumRiskAnalyses,
				low: lowRiskAnalyses,
			},
		};
	},
});

/**
 * Get risky files for a repository
 */
export const getRepositoryRiskyFiles = query({
	args: {
		repoId: v.string(),
		limit: v.optional(v.number()),
		offset: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const repoId = ctx.db.normalizeId("repositories", args.repoId);
		if (!repoId) return { files: [], total: 0 };

		const limit = args.limit ?? 10;
		const offset = args.offset ?? 0;

		// Get all file risk stats for this repo
		const allFileStats = await ctx.db
			.query("file_risk_stats")
			.withIndex("by_repo_highRisk", (q) => q.eq("repoId", repoId))
			.collect();

		// Sort by risk (high risk count first, then medium, then total)
		const sorted = allFileStats.sort((a, b) => {
			if (b.highRiskCount !== a.highRiskCount) return b.highRiskCount - a.highRiskCount;
			if (b.mediumRiskCount !== a.mediumRiskCount) return b.mediumRiskCount - a.mediumRiskCount;
			return b.totalAnalysesTouching - a.totalAnalysesTouching;
		});

		// Apply pagination
		const paginated = sorted.slice(offset, offset + limit);

		// Enrich with additional data
		const files = paginated.map(f => {
			// Calculate risk score (0-100)
			const risk = Math.min(100, f.highRiskCount * 30 + f.mediumRiskCount * 10 + f.lowRiskCount * 2);
			const riskLevel = risk >= 75 ? "critical" : risk >= 50 ? "high" : risk >= 25 ? "medium" : "low";

			return {
				file: f.filePath,
				risk,
				riskLevel,
				highRiskCount: f.highRiskCount,
				mediumRiskCount: f.mediumRiskCount,
				lowRiskCount: f.lowRiskCount,
				totalAnalyses: f.totalAnalysesTouching,
				lastTouchedAt: f.lastTouchedAt,
			};
		});

		return {
			files,
			total: allFileStats.length,
		};
	},
});

/**
 * Get recent activity for a repository
 */
export const getRepositoryActivity = query({
	args: {
		repoId: v.string(),
		limit: v.optional(v.number()),
		offset: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const repoId = ctx.db.normalizeId("repositories", args.repoId);
		if (!repoId) return { activities: [], total: 0 };

		const limit = args.limit ?? 10;
		const offset = args.offset ?? 0;

		// Get analyses for this repo (ordered by createdAt desc)
		const analyses = await ctx.db
			.query("analyses")
			.withIndex("by_repo_createdAt", (q) => q.eq("repoId", repoId))
			.order("desc")
			.collect();

		const total = analyses.length;
		const paginated = analyses.slice(offset, offset + limit);

		const activities = paginated.map(a => {
			const type = a.riskLevel === "high" && a.commentPosted ? "prevented" :
						 a.riskLevel === "low" ? "safe" : "analysis";

			// Get first changed file as representative
			const file = a.changedFiles[0] || "unknown";

			return {
				type,
				file,
				risk: a.score || 0,
				time: a.createdAt,
				result: a.summary || `${a.riskLevel} risk analysis`,
				riskLevel: a.riskLevel,
				changedFilesCount: a.changedFiles.length,
			};
		});

		return {
			activities,
			total,
		};
	},
});

/**
 * Get file coupling data for a repository
 */
export const getRepositoryCoupling = query({
	args: {
		repoId: v.string(),
		limit: v.optional(v.number()),
		offset: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const repoId = ctx.db.normalizeId("repositories", args.repoId);
		if (!repoId) return { pairs: [], total: 0 };

		const limit = args.limit ?? 10;
		const offset = args.offset ?? 0;

		// Get analyses that have missing co-changed files
		const analyses = await ctx.db
			.query("analyses")
			.withIndex("by_repo", (q) => q.eq("repoId", repoId))
			.collect();

		// Build coupling map from missing co-changed files
		const couplingMap = new Map<string, { primary: string; coupled: string; strength: number; coChanges: number }>();

		for (const analysis of analyses) {
			if (analysis.missingCoChangedFiles && analysis.missingCoChangedFiles.length > 0) {
				for (const changedFile of analysis.changedFiles) {
					for (const missing of analysis.missingCoChangedFiles) {
						const key = `${changedFile}:${missing.file}`;
						const existing = couplingMap.get(key);
						if (existing) {
							existing.coChanges++;
							existing.strength = Math.min(100, Math.round(missing.probability * 100));
						} else {
							couplingMap.set(key, {
								primary: changedFile,
								coupled: missing.file,
								strength: Math.round(missing.probability * 100),
								coChanges: 1,
							});
						}
					}
				}
			}
		}

		// Convert to array and sort by strength
		const allPairs = Array.from(couplingMap.values()).sort((a, b) => b.strength - a.strength);
		const paginated = allPairs.slice(offset, offset + limit);

		return {
			pairs: paginated,
			total: allPairs.length,
		};
	},
});

/**
 * Get chart data for repository (last 30 days)
 */
export const getRepositoryChartData = query({
	args: { repoId: v.string() },
	handler: async (ctx, args) => {
		const repoId = ctx.db.normalizeId("repositories", args.repoId);
		if (!repoId) return [];

		// Get daily stats for this repo
		const stats = await ctx.db
			.query("daily_repo_stats")
			.withIndex("by_repo_date", (q) => q.eq("repoId", repoId))
			.collect();

		// Create a map of date -> stats
		const statsMap = new Map(stats.map(s => [s.date, s]));

		// Generate last 30 days
		const chartData = [];
		const nowMs = Date.now();
		for (let i = 29; i >= 0; i--) {
			const date = new Date(nowMs);
			date.setDate(date.getDate() - i);
			const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
			const displayDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

			const dayStats = statsMap.get(dateStr);
			chartData.push({
				date: displayDate,
				analyses: dayStats?.prAnalysesCount || 0,
				prevented: dayStats?.highRiskAnalysesCount || 0,
				avgRisk: dayStats?.averageRiskScore || 0,
			});
		}

		return chartData;
	},
});

/**
 * Get top contributors for a repository (from commit data)
 */
export const getRepositoryContributors = query({
	args: { repoId: v.string(), limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const repoId = ctx.db.normalizeId("repositories", args.repoId);
		if (!repoId) return [];

		const limit = args.limit ?? 5;

		// Get commits for this repo
		const commits = await ctx.db
			.query("commits")
			.withIndex("by_repo_sha", (q) => q.eq("repoId", repoId))
			.collect();

		// Group by author
		const authorMap = new Map<string, { name: string; email: string; commits: number }>();
		for (const commit of commits) {
			const key = commit.authorEmail;
			const existing = authorMap.get(key);
			if (existing) {
				existing.commits++;
			} else {
				authorMap.set(key, {
					name: commit.authorName,
					email: commit.authorEmail,
					commits: 1,
				});
			}
		}

		// Sort by commits and take top N
		const sorted = Array.from(authorMap.values())
			.sort((a, b) => b.commits - a.commits)
			.slice(0, limit);

		return sorted.map(c => ({
			name: c.name,
			avatar: null, // Could be fetched from GitHub API
			commits: c.commits,
			filesOwned: 0, // Would need file ownership tracking
		}));
	},
});
