import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

const now = () => Date.now();

// Helper for creating union of literals
const literals = <T extends string>(...values: T[]) =>
	v.union(...values.map((val) => v.literal(val))) as ReturnType<typeof v.literal<T>>;

const installationStatusValidator = literals("active", "suspended", "deleted");

/**
 * Update installation status (suspended/deleted)
 */
export const updateInstallationStatus = internalMutation({
	args: {
		providerInstallationId: v.string(),
		status: installationStatusValidator,
	},
	handler: async (ctx, args) => {
		const installation = await ctx.db
			.query("scm_installations")
			.withIndex("by_providerInstallation", (q) =>
				q
					.eq("providerType", "github")
					.eq("providerInstallationId", args.providerInstallationId)
			)
			.first();

		if (installation) {
			await ctx.db.patch(installation._id, {
				status: args.status,
				updatedAt: now(),
			});
			return { updated: true };
		}

		return { updated: false };
	},
});

/**
 * Deactivate a repository (mark as inactive)
 */
export const deactivateRepository = internalMutation({
	args: { providerRepoId: v.string() },
	handler: async (ctx, args) => {
		const repo = await ctx.db
			.query("repositories")
			.withIndex("by_provider_repo", (q) =>
				q.eq("providerType", "github").eq("providerRepoId", args.providerRepoId)
			)
			.first();

		if (repo) {
			await ctx.db.patch(repo._id, {
				isActive: false,
				updatedAt: now(),
			});
			return { updated: true };
		}

		return { updated: false };
	},
});
