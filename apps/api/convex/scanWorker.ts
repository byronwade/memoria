import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Trigger a repository scan via the web API
 *
 * Convex actions can't run long file system operations directly,
 * so we use an HTTP action to trigger the web API which does the actual scanning.
 * The web API then calls back to Convex to store results.
 */
export const triggerScan = internalAction({
	args: {
		scanId: v.id("repository_scans"),
		repositoryId: v.id("repositories"),
		installationId: v.string(),
		fullName: v.string(),
		apiBaseUrl: v.string(),
	},
	handler: async (ctx, args) => {
		const { scanId, repositoryId, installationId, fullName, apiBaseUrl } = args;

		try {
			// Update status to running
			await ctx.runMutation(internal.scans.internalUpdateScanProgress, {
				scanId,
				status: "running",
			});

			// Call the web API to perform the actual scan
			// The API will clone the repo, run analysis, and store results via Convex
			const response = await fetch(`${apiBaseUrl}/api/scans/execute`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					// Internal API key for server-to-server auth
					"X-Internal-Key": process.env.INTERNAL_API_KEY || "memoria-internal",
				},
				body: JSON.stringify({
					scanId,
					repositoryId,
					installationId,
					fullName,
				}),
			});

			if (!response.ok) {
				const error = await response.text();
				throw new Error(`Scan API failed: ${response.status} - ${error}`);
			}

			// The API will update the scan status when complete
			// We just need to verify it started successfully
			const result = await response.json();
			return { success: true, message: result.message || "Scan started" };
		} catch (error) {
			// Mark scan as failed
			await ctx.runMutation(internal.scans.internalUpdateScanProgress, {
				scanId,
				status: "failed",
				errorMessage: error instanceof Error ? error.message : "Unknown error",
			});

			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

/**
 * Batch store file analyses (called from web API)
 * More efficient than storing one at a time
 */
export const batchStoreFileAnalyses = internalAction({
	args: {
		scanId: v.id("repository_scans"),
		repositoryId: v.id("repositories"),
		analyses: v.array(
			v.object({
				filePath: v.string(),
				riskScore: v.number(),
				riskLevel: v.union(
					v.literal("low"),
					v.literal("medium"),
					v.literal("high"),
					v.literal("critical"),
				),
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

		// Store each analysis
		for (const analysis of analyses) {
			await ctx.runMutation(internal.scans.storeFileAnalysis, {
				scanId,
				repositoryId,
				...analysis,
			});
		}

		return { stored: analyses.length };
	},
});
