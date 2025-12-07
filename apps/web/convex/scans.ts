import { mutation, query, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const now = () => Date.now();

// Helper for creating union of literals
const literals = <T extends string>(...values: T[]) =>
	v.union(...values.map((val) => v.literal(val)));

const scanStatusValidator = literals("pending", "running", "completed", "failed");
const triggerTypeValidator = literals("onboarding", "manual", "scheduled");
const riskLevelValidator = literals("low", "medium", "high", "critical");

/**
 * Create a new scan record for a repository
 */
export const createScan = mutation({
	args: {
		repositoryId: v.id("repositories"),
		triggeredBy: triggerTypeValidator,
	},
	handler: async (ctx, args) => {
		// Check if there's already a running or pending scan for this repo
		const existingRunning = await ctx.db
			.query("repository_scans")
			.withIndex("by_repository_status", (q) =>
				q.eq("repositoryId", args.repositoryId).eq("status", "running"),
			)
			.first();

		if (existingRunning) {
			return { scanId: existingRunning._id, alreadyRunning: true };
		}

		const existingPending = await ctx.db
			.query("repository_scans")
			.withIndex("by_repository_status", (q) =>
				q.eq("repositoryId", args.repositoryId).eq("status", "pending"),
			)
			.first();

		if (existingPending) {
			return { scanId: existingPending._id, alreadyRunning: true };
		}

		const scanId = await ctx.db.insert("repository_scans", {
			repositoryId: args.repositoryId,
			status: "pending",
			triggeredBy: args.triggeredBy,
			startedAt: null,
			completedAt: null,
			errorMessage: null,
			totalFiles: 0,
			processedFiles: 0,
			filesWithRisk: 0,
			createdAt: now(),
			updatedAt: null,
		});

		return { scanId, alreadyRunning: false };
	},
});

/**
 * Update scan progress (internal mutation for background worker)
 */
export const internalUpdateScanProgress = internalMutation({
	args: {
		scanId: v.id("repository_scans"),
		status: v.optional(scanStatusValidator),
		totalFiles: v.optional(v.number()),
		processedFiles: v.optional(v.number()),
		filesWithRisk: v.optional(v.number()),
		errorMessage: v.optional(v.union(v.string(), v.null())),
	},
	handler: async (ctx, args) => {
		const patch: Record<string, unknown> = { updatedAt: now() };

		if (args.status) {
			patch.status = args.status;
			if (args.status === "running") {
				patch.startedAt = now();
			}
			if (args.status === "completed" || args.status === "failed") {
				patch.completedAt = now();
			}
		}
		if (args.totalFiles !== undefined) patch.totalFiles = args.totalFiles;
		if (args.processedFiles !== undefined) patch.processedFiles = args.processedFiles;
		if (args.filesWithRisk !== undefined) patch.filesWithRisk = args.filesWithRisk;
		if (args.errorMessage !== undefined) patch.errorMessage = args.errorMessage;

		await ctx.db.patch(args.scanId, patch);
	},
});

/**
 * Store a file analysis result (internal mutation for background worker)
 */
export const storeFileAnalysis = internalMutation({
	args: {
		scanId: v.id("repository_scans"),
		repositoryId: v.id("repositories"),
		filePath: v.string(),
		riskScore: v.number(),
		riskLevel: riskLevelValidator,
		volatilityScore: v.number(),
		couplingScore: v.number(),
		driftScore: v.number(),
		importerCount: v.number(),
		coupledFiles: v.array(
			v.object({
				file: v.string(),
				score: v.number(),
				changeType: v.string(),
			}),
		),
		staticDependents: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		// Upsert - check if analysis exists for this file in this repository
		const existing = await ctx.db
			.query("file_analyses")
			.withIndex("by_repository_file", (q) =>
				q.eq("repositoryId", args.repositoryId).eq("filePath", args.filePath),
			)
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				scanId: args.scanId,
				riskScore: args.riskScore,
				riskLevel: args.riskLevel,
				volatilityScore: args.volatilityScore,
				couplingScore: args.couplingScore,
				driftScore: args.driftScore,
				importerCount: args.importerCount,
				coupledFiles: args.coupledFiles,
				staticDependents: args.staticDependents,
				lastAnalyzedAt: now(),
			});
			return { fileAnalysisId: existing._id, updated: true };
		}

		const fileAnalysisId = await ctx.db.insert("file_analyses", {
			scanId: args.scanId,
			repositoryId: args.repositoryId,
			filePath: args.filePath,
			riskScore: args.riskScore,
			riskLevel: args.riskLevel,
			volatilityScore: args.volatilityScore,
			couplingScore: args.couplingScore,
			driftScore: args.driftScore,
			importerCount: args.importerCount,
			coupledFiles: args.coupledFiles,
			staticDependents: args.staticDependents,
			lastAnalyzedAt: now(),
			createdAt: now(),
		});

		return { fileAnalysisId, updated: false };
	},
});

/**
 * Get the latest scan status for a repository
 */
export const getScanStatus = query({
	args: { repositoryId: v.string() },
	handler: async (ctx, args) => {
		const normalizedId = ctx.db.normalizeId("repositories", args.repositoryId);
		if (!normalizedId) return null;

		const scan = await ctx.db
			.query("repository_scans")
			.withIndex("by_repository", (q) => q.eq("repositoryId", normalizedId))
			.order("desc")
			.first();

		return scan;
	},
});

/**
 * Get all scans for a repository (for history view)
 */
export const getScansForRepository = query({
	args: { repositoryId: v.string() },
	handler: async (ctx, args) => {
		const normalizedId = ctx.db.normalizeId("repositories", args.repositoryId);
		if (!normalizedId) return [];

		return ctx.db
			.query("repository_scans")
			.withIndex("by_repository", (q) => q.eq("repositoryId", normalizedId))
			.order("desc")
			.collect();
	},
});

/**
 * Get file analyses for a repository
 */
export const getFileAnalyses = query({
	args: {
		repositoryId: v.string(),
		limit: v.optional(v.number()),
		minRiskScore: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const normalizedId = ctx.db.normalizeId("repositories", args.repositoryId);
		if (!normalizedId) return [];

		const limit = args.limit ?? 100;

		let analyses = await ctx.db
			.query("file_analyses")
			.withIndex("by_repository", (q) => q.eq("repositoryId", normalizedId))
			.order("desc")
			.take(limit * 2); // Take more to filter

		// Filter by minimum risk score if specified
		if (args.minRiskScore !== undefined) {
			analyses = analyses.filter((a) => a.riskScore >= args.minRiskScore!);
		}

		// Sort by risk score descending and limit
		return analyses.sort((a, b) => b.riskScore - a.riskScore).slice(0, limit);
	},
});

/**
 * Get risky files for a repository (files with risk score >= 25)
 */
export const getRiskyFiles = query({
	args: { repositoryId: v.string(), limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const normalizedId = ctx.db.normalizeId("repositories", args.repositoryId);
		if (!normalizedId) return [];

		const limit = args.limit ?? 20;

		const analyses = await ctx.db
			.query("file_analyses")
			.withIndex("by_repository", (q) => q.eq("repositoryId", normalizedId))
			.collect();

		// Filter and sort by risk score
		return analyses
			.filter((a) => a.riskScore >= 25)
			.sort((a, b) => b.riskScore - a.riskScore)
			.slice(0, limit)
			.map((a) => ({
				filePath: a.filePath,
				riskScore: a.riskScore,
				riskLevel: a.riskLevel,
				volatilityScore: a.volatilityScore,
				couplingScore: a.couplingScore,
				importerCount: a.importerCount,
				lastAnalyzedAt: a.lastAnalyzedAt,
			}));
	},
});

/**
 * Get scan summary statistics for a repository
 */
export const getScanSummary = query({
	args: { repositoryId: v.string() },
	handler: async (ctx, args) => {
		const normalizedId = ctx.db.normalizeId("repositories", args.repositoryId);
		if (!normalizedId)
			return {
				totalScans: 0,
				lastScan: null,
				totalFilesAnalyzed: 0,
				filesWithRisk: 0,
				averageRiskScore: 0,
			};

		// Get all scans
		const scans = await ctx.db
			.query("repository_scans")
			.withIndex("by_repository", (q) => q.eq("repositoryId", normalizedId))
			.order("desc")
			.collect();

		// Get latest completed scan
		const lastCompletedScan = scans.find((s) => s.status === "completed");

		// Get all file analyses
		const analyses = await ctx.db
			.query("file_analyses")
			.withIndex("by_repository", (q) => q.eq("repositoryId", normalizedId))
			.collect();

		const filesWithRisk = analyses.filter((a) => a.riskScore >= 25).length;
		const averageRiskScore =
			analyses.length > 0 ? analyses.reduce((sum, a) => sum + a.riskScore, 0) / analyses.length : 0;

		return {
			totalScans: scans.length,
			lastScan: lastCompletedScan
				? {
						_id: lastCompletedScan._id,
						status: lastCompletedScan.status,
						completedAt: lastCompletedScan.completedAt,
						totalFiles: lastCompletedScan.totalFiles,
						filesWithRisk: lastCompletedScan.filesWithRisk,
					}
				: null,
			totalFilesAnalyzed: analyses.length,
			filesWithRisk,
			averageRiskScore: Math.round(averageRiskScore),
		};
	},
});

/**
 * Batch store file analyses (called from web API)
 * More efficient than storing one at a time
 */
export const batchStoreFileAnalyses = mutation({
	args: {
		scanId: v.id("repository_scans"),
		repositoryId: v.id("repositories"),
		analyses: v.array(
			v.object({
				filePath: v.string(),
				riskScore: v.number(),
				riskLevel: riskLevelValidator,
				volatilityScore: v.number(),
				couplingScore: v.number(),
				driftScore: v.number(),
				importerCount: v.number(),
				coupledFiles: v.array(
					v.object({
						file: v.string(),
						score: v.number(),
						changeType: v.string(),
					}),
				),
				staticDependents: v.array(v.string()),
			}),
		),
	},
	handler: async (ctx, args) => {
		const { scanId, repositoryId, analyses } = args;
		let stored = 0;

		// Store each analysis
		for (const analysis of analyses) {
			// Check if analysis exists for this file
			const existing = await ctx.db
				.query("file_analyses")
				.withIndex("by_repository_file", (q) =>
					q.eq("repositoryId", repositoryId).eq("filePath", analysis.filePath),
				)
				.first();

			if (existing) {
				await ctx.db.patch(existing._id, {
					scanId,
					riskScore: analysis.riskScore,
					riskLevel: analysis.riskLevel,
					volatilityScore: analysis.volatilityScore,
					couplingScore: analysis.couplingScore,
					driftScore: analysis.driftScore,
					importerCount: analysis.importerCount,
					coupledFiles: analysis.coupledFiles,
					staticDependents: analysis.staticDependents,
					lastAnalyzedAt: now(),
				});
			} else {
				await ctx.db.insert("file_analyses", {
					scanId,
					repositoryId,
					filePath: analysis.filePath,
					riskScore: analysis.riskScore,
					riskLevel: analysis.riskLevel,
					volatilityScore: analysis.volatilityScore,
					couplingScore: analysis.couplingScore,
					driftScore: analysis.driftScore,
					importerCount: analysis.importerCount,
					coupledFiles: analysis.coupledFiles,
					staticDependents: analysis.staticDependents,
					lastAnalyzedAt: now(),
					createdAt: now(),
				});
			}
			stored++;
		}

		return { stored };
	},
});

/**
 * Update scan progress (public mutation for web API)
 */
export const updateScanProgress = mutation({
	args: {
		scanId: v.id("repository_scans"),
		repositoryId: v.optional(v.id("repositories")),
		status: v.optional(scanStatusValidator),
		totalFiles: v.optional(v.number()),
		processedFiles: v.optional(v.number()),
		filesWithRisk: v.optional(v.number()),
		errorMessage: v.optional(v.union(v.string(), v.null())),
	},
	handler: async (ctx, args) => {
		const patch: Record<string, unknown> = { updatedAt: now() };

		if (args.status) {
			patch.status = args.status;
			if (args.status === "running") {
				patch.startedAt = now();
			}
			if (args.status === "completed" || args.status === "failed") {
				patch.completedAt = now();
			}
		}
		if (args.totalFiles !== undefined) patch.totalFiles = args.totalFiles;
		if (args.processedFiles !== undefined) patch.processedFiles = args.processedFiles;
		if (args.filesWithRisk !== undefined) patch.filesWithRisk = args.filesWithRisk;
		if (args.errorMessage !== undefined) patch.errorMessage = args.errorMessage;

		await ctx.db.patch(args.scanId, patch);

		// Update repository lastAnalyzedAt when scan completes
		if (args.status === "completed" && args.repositoryId) {
			await ctx.db.patch(args.repositoryId, {
				lastAnalyzedAt: now(),
				updatedAt: now(),
			});
		}
	},
});

/**
 * Cancel a stuck scan (mark as failed)
 */
export const cancelScan = mutation({
	args: { scanId: v.id("repository_scans") },
	handler: async (ctx, args) => {
		const scan = await ctx.db.get(args.scanId);
		if (!scan) return { success: false, error: "Scan not found" };

		if (scan.status === "completed" || scan.status === "failed") {
			return { success: false, error: "Scan already finished" };
		}

		await ctx.db.patch(args.scanId, {
			status: "failed",
			errorMessage: "Cancelled by user",
			completedAt: now(),
			updatedAt: now(),
		});

		return { success: true };
	},
});

/**
 * Reset all stuck scans for a repository (cancel running/pending)
 */
export const resetStuckScans = mutation({
	args: { repositoryId: v.id("repositories") },
	handler: async (ctx, args) => {
		const runningScans = await ctx.db
			.query("repository_scans")
			.withIndex("by_repository_status", (q) =>
				q.eq("repositoryId", args.repositoryId).eq("status", "running"),
			)
			.collect();

		const pendingScans = await ctx.db
			.query("repository_scans")
			.withIndex("by_repository_status", (q) =>
				q.eq("repositoryId", args.repositoryId).eq("status", "pending"),
			)
			.collect();

		const stuckScans = [...runningScans, ...pendingScans];

		for (const scan of stuckScans) {
			await ctx.db.patch(scan._id, {
				status: "failed",
				errorMessage: "Reset: scan was stuck",
				completedAt: now(),
				updatedAt: now(),
			});
		}

		return { resetCount: stuckScans.length };
	},
});

/**
 * Get pending/running scans across all repositories for a user
 */
export const getActiveScansForUser = query({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		// Get all repositories for this user
		const repos = await ctx.db
			.query("repositories")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();

		const repoIds = new Set(repos.map((r) => r._id));

		// Get all pending/running scans
		const pendingScans = await ctx.db
			.query("repository_scans")
			.withIndex("by_status", (q) => q.eq("status", "pending"))
			.collect();

		const runningScans = await ctx.db
			.query("repository_scans")
			.withIndex("by_status", (q) => q.eq("status", "running"))
			.collect();

		const activeScans = [...pendingScans, ...runningScans].filter((s) =>
			repoIds.has(s.repositoryId),
		);

		// Add repo info
		return activeScans.map((scan) => {
			const repo = repos.find((r) => r._id === scan.repositoryId);
			return {
				...scan,
				repositoryName: repo?.fullName ?? "Unknown",
			};
		});
	},
});
