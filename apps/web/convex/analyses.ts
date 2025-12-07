import { mutation } from "./_generated/server";
import { v } from "convex/values";

const now = () => Date.now();

// Helper for creating union of literals
const literals = <T extends string>(...values: T[]) =>
	v.union(...values.map((val) => v.literal(val))) as ReturnType<typeof v.literal<T>>;

const analysisTypeValidator = literals("pull_request", "commit", "manual");
const riskLevelValidator = literals("low", "medium", "high", "informational");
const riskLevelShortValidator = literals("low", "medium", "high");
const findingKindValidator = literals("co_change_missing", "hotspot_file", "test_missing", "config_warning", "other");
const severityValidator = literals("low", "medium", "high");

export const recordAnalysis = mutation({
	args: {
		userId: v.id("users"),
		repoId: v.id("repositories"),
		pullRequestId: v.optional(v.id("pull_requests")),
		commitSha: v.union(v.string(), v.null()),
		analysisType: analysisTypeValidator,
		engineVersion: v.string(),
		riskLevel: riskLevelValidator,
		score: v.union(v.number(), v.null()),
		changedFiles: v.array(v.string()),
		missingCoChangedFiles: v.array(v.object({ file: v.string(), probability: v.number() })),
		suggestedTests: v.array(v.string()),
		summary: v.string(),
		rawResult: v.any(),
		commentPosted: v.boolean(),
		commentUrl: v.union(v.string(), v.null()),
		durationMs: v.union(v.number(), v.null()),
	},
	handler: async (ctx, args) => {
		const analysisId = await ctx.db.insert("analyses", {
			...args,
			createdAt: now(),
		});

		if (args.pullRequestId) {
			const pr = await ctx.db.get(args.pullRequestId);
			if (pr) {
				await ctx.db.patch(pr._id, { lastAnalyzedAt: now(), lastAnalysisId: analysisId });
			}
		}

		await ctx.db.insert("events", {
			userId: args.userId,
			repoId: args.repoId,
			pullRequestId: args.pullRequestId,
			type: "analysis.completed",
			context: { riskLevel: args.riskLevel, score: args.score },
			createdAt: now(),
		});

		return { analysisId };
	},
});

export const addFinding = mutation({
	args: {
		analysisId: v.id("analyses"),
		kind: findingKindValidator,
		severity: severityValidator,
		filePath: v.union(v.string(), v.null()),
		details: v.string(),
		data: v.union(v.any(), v.null()),
	},
	handler: async (ctx, args) => {
		const findingId = await ctx.db.insert("analysis_findings", {
			...args,
			createdAt: now(),
		});
		return { findingId };
	},
});

export const updateFileRisk = mutation({
	args: {
		repoId: v.id("repositories"),
		filePath: v.string(),
		riskLevel: riskLevelShortValidator,
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("file_risk_stats")
			.withIndex("by_repo_file", (q) => q.eq("repoId", args.repoId).eq("filePath", args.filePath))
			.first();

		const base = {
			highRiskCount: 0,
			mediumRiskCount: 0,
			lowRiskCount: 0,
			totalAnalysesTouching: 0,
			lastTouchedAt: now(),
			createdAt: now(),
			updatedAt: null as number | null,
		};

		if (existing) {
			const patch = {
				highRiskCount: existing.highRiskCount + (args.riskLevel === "high" ? 1 : 0),
				mediumRiskCount: existing.mediumRiskCount + (args.riskLevel === "medium" ? 1 : 0),
				lowRiskCount: existing.lowRiskCount + (args.riskLevel === "low" ? 1 : 0),
				totalAnalysesTouching: existing.totalAnalysesTouching + 1,
				lastTouchedAt: now(),
				updatedAt: now(),
			};
			await ctx.db.patch(existing._id, patch);
			return { fileRiskId: existing._id };
		}

		const fileRiskId = await ctx.db.insert("file_risk_stats", {
			repoId: args.repoId,
			filePath: args.filePath,
			...base,
			highRiskCount: base.highRiskCount + (args.riskLevel === "high" ? 1 : 0),
			mediumRiskCount: base.mediumRiskCount + (args.riskLevel === "medium" ? 1 : 0),
			lowRiskCount: base.lowRiskCount + (args.riskLevel === "low" ? 1 : 0),
			totalAnalysesTouching: 1,
		});
		return { fileRiskId };
	},
});

export const bumpDailyStats = mutation({
	args: {
		userId: v.id("users"),
		repoId: v.id("repositories"),
		date: v.string(),
		riskLevel: riskLevelValidator,
		riskScore: v.union(v.number(), v.null()),
	},
	handler: async (ctx, args) => {
		const userStats = await ctx.db
			.query("daily_user_stats")
			.withIndex("by_userId_date", (q) => q.eq("userId", args.userId).eq("date", args.date))
			.first();
		if (userStats) {
			await ctx.db.patch(userStats._id, {
				prAnalysesCount: userStats.prAnalysesCount + 1,
				highRiskAnalysesCount: userStats.highRiskAnalysesCount + (args.riskLevel === "high" ? 1 : 0),
				mediumRiskAnalysesCount: userStats.mediumRiskAnalysesCount + (args.riskLevel === "medium" ? 1 : 0),
				lowRiskAnalysesCount: userStats.lowRiskAnalysesCount + (args.riskLevel === "low" ? 1 : 0),
				averageRiskScore:
					args.riskScore !== null
						? ((userStats.averageRiskScore ?? 0) + args.riskScore) / 2
						: userStats.averageRiskScore,
			});
		} else {
			await ctx.db.insert("daily_user_stats", {
				userId: args.userId,
				date: args.date,
				prAnalysesCount: 1,
				highRiskAnalysesCount: args.riskLevel === "high" ? 1 : 0,
				mediumRiskAnalysesCount: args.riskLevel === "medium" ? 1 : 0,
				lowRiskAnalysesCount: args.riskLevel === "low" ? 1 : 0,
				averageRiskScore: args.riskScore,
				reposActiveCount: 0,
				createdAt: now(),
			});
		}

		const repoStats = await ctx.db
			.query("daily_repo_stats")
			.withIndex("by_repo_date", (q) => q.eq("repoId", args.repoId).eq("date", args.date))
			.first();
		if (repoStats) {
			await ctx.db.patch(repoStats._id, {
				prAnalysesCount: repoStats.prAnalysesCount + 1,
				highRiskAnalysesCount: repoStats.highRiskAnalysesCount + (args.riskLevel === "high" ? 1 : 0),
				mediumRiskAnalysesCount: repoStats.mediumRiskAnalysesCount + (args.riskLevel === "medium" ? 1 : 0),
				lowRiskAnalysesCount: repoStats.lowRiskAnalysesCount + (args.riskLevel === "low" ? 1 : 0),
				averageRiskScore:
					args.riskScore !== null
						? ((repoStats.averageRiskScore ?? 0) + args.riskScore) / 2
						: repoStats.averageRiskScore,
			});
		} else {
			await ctx.db.insert("daily_repo_stats", {
				repoId: args.repoId,
				date: args.date,
				prAnalysesCount: 1,
				highRiskAnalysesCount: args.riskLevel === "high" ? 1 : 0,
				mediumRiskAnalysesCount: args.riskLevel === "medium" ? 1 : 0,
				lowRiskAnalysesCount: args.riskLevel === "low" ? 1 : 0,
				averageRiskScore: args.riskScore,
				createdAt: now(),
			});
		}
		return { updated: true };
	},
});
