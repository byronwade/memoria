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
		orgId: v.string(), // Accept string, will be normalized
		accountType: accountTypeValidator,
		accountLogin: v.string(),
		accountName: v.union(v.string(), v.null()),
		permissions: v.union(v.any(), v.null()),
		status: installationStatusValidator,
	},
	handler: async (ctx, args) => {
		// Normalize orgId
		const orgId = ctx.db.normalizeId("organizations", args.orgId);
		if (!orgId) {
			throw new Error("Invalid organization ID");
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
			orgId,
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
		orgId: v.string(), // Accept string, will be normalized
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
		const orgId = ctx.db.normalizeId("organizations", args.orgId);
		const scmInstallationId = ctx.db.normalizeId("scm_installations", args.scmInstallationId);
		if (!orgId || !scmInstallationId) {
			throw new Error("Invalid organization or installation ID");
		}

		const existing = await ctx.db
			.query("repositories")
			.withIndex("by_provider_repo", (q) =>
				q.eq("providerType", args.providerType).eq("providerRepoId", args.providerRepoId),
			)
			.first();

		const data = {
			orgId,
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
	args: { repoId: v.id("repositories") },
	handler: async (ctx, args) => ctx.db.get(args.repoId),
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
	args: { orgId: v.string() },
	handler: async (ctx, args) => {
		const orgId = ctx.db.normalizeId("organizations", args.orgId);
		if (!orgId) return [];
		return ctx.db
			.query("scm_installations")
			.withIndex("by_org", (q) => q.eq("orgId", orgId))
			.collect();
	},
});

export const getRepositories = query({
	args: { orgId: v.string() },
	handler: async (ctx, args) => {
		const orgId = ctx.db.normalizeId("organizations", args.orgId);
		if (!orgId) return [];
		return ctx.db
			.query("repositories")
			.withIndex("by_org", (q) => q.eq("orgId", orgId))
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

