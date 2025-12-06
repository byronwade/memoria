import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const now = () => Date.now();

// Helper for creating union of literals
const literals = <T extends string>(...values: T[]) =>
	v.union(...values.map((val) => v.literal(val))) as ReturnType<typeof v.literal<T>>;

const inviteRoleValidator = literals("admin", "member", "viewer");
const riskCommentModeValidator = literals("short", "detailed");
const analysisDepthValidator = literals("fast", "standard", "deep");

export const createOrganization = mutation({
	args: {
		name: v.string(),
		slug: v.string(),
		ownerUserId: v.string(), // Accept string, will be normalized to Id
		planId: v.optional(v.string()), // Accept string for planId too
	},
	handler: async (ctx, args) => {
		// Normalize IDs
		const ownerUserId = ctx.db.normalizeId("users", args.ownerUserId);
		if (!ownerUserId) {
			throw new Error("Invalid owner user ID");
		}

		const planId = args.planId ? ctx.db.normalizeId("billing_plans", args.planId) : undefined;

		const orgId = await ctx.db.insert("organizations", {
			name: args.name,
			slug: args.slug,
			ownerUserId,
			planId,
			stripeCustomerId: null,
			stripeSubscriptionId: null,
			maxRepos: null,
			maxAnalysesPerMonth: null,
			status: "trial",
			trialEndsAt: null,
			createdAt: now(),
			updatedAt: null,
		});

		await ctx.db.insert("org_memberships", {
			orgId,
			userId: ownerUserId,
			role: "owner",
			createdAt: now(),
		});

		await ctx.db.insert("org_settings", {
			orgId,
			riskCommentMode: "short",
			enableSlackNotifications: false,
			slackWebhookUrl: null,
			defaultProvider: null,
			analysisDepth: "standard",
			createdAt: now(),
			updatedAt: null,
		});

		const owner = await ctx.db.get(ownerUserId);
		if (owner?.primaryOrgId === null) {
			await ctx.db.patch(ownerUserId, { primaryOrgId: orgId });
		}

		return { orgId };
	},
});

export const getOrg = query({
	args: { orgId: v.id("organizations") },
	handler: async (ctx, args) => ctx.db.get(args.orgId),
});

export const createInvitation = mutation({
	args: {
		orgId: v.id("organizations"),
		email: v.string(),
		invitedByUserId: v.id("users"),
		role: inviteRoleValidator,
		token: v.string(),
		expiresAt: v.number(),
	},
	handler: async (ctx, args) => {
		const invitationId = await ctx.db.insert("org_invitations", {
			...args,
			status: "pending",
			createdAt: now(),
			acceptedAt: null,
		});
		return { invitationId };
	},
});

export const acceptInvitation = mutation({
	args: {
		token: v.string(),
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const invitation = await ctx.db
			.query("org_invitations")
			.withIndex("by_token", (q) => q.eq("token", args.token))
			.first();
		if (!invitation || invitation.status !== "pending" || invitation.expiresAt < now()) {
			return { accepted: false };
		}
		await ctx.db.patch(invitation._id, {
			status: "accepted",
			acceptedAt: now(),
		});
		await ctx.db.insert("org_memberships", {
			orgId: invitation.orgId,
			userId: args.userId,
			role: invitation.role,
			createdAt: now(),
		});
		return { accepted: true, orgId: invitation.orgId };
	},
});

export const updateOrgSettings = mutation({
	args: {
		orgId: v.id("organizations"),
		riskCommentMode: v.optional(riskCommentModeValidator),
		enableSlackNotifications: v.optional(v.boolean()),
		slackWebhookUrl: v.optional(v.union(v.string(), v.null())),
		defaultProvider: v.optional(
			v.union(v.literal("github"), v.literal("gitlab"), v.literal("bitbucket"), v.literal("other"), v.null()),
		),
		analysisDepth: v.optional(analysisDepthValidator),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("org_settings")
			.withIndex("by_org", (q) => q.eq("orgId", args.orgId))
			.first();
		if (!existing) throw new Error("Org settings not found");

		const patch: Record<string, unknown> = { updatedAt: now() };
		if (args.riskCommentMode) patch.riskCommentMode = args.riskCommentMode;
		if (args.enableSlackNotifications !== undefined) patch.enableSlackNotifications = args.enableSlackNotifications;
		if (args.slackWebhookUrl !== undefined) patch.slackWebhookUrl = args.slackWebhookUrl;
		if (args.defaultProvider !== undefined) patch.defaultProvider = args.defaultProvider;
		if (args.analysisDepth) patch.analysisDepth = args.analysisDepth;

		await ctx.db.patch(existing._id, patch);
		return { orgId: existing.orgId };
	},
});

export const listOrgsForUser = query({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		const memberships = await ctx.db
			.query("org_memberships")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();
		const orgs = await Promise.all(memberships.map((m) => ctx.db.get(m.orgId)));
		return orgs.filter(Boolean);
	},
});

// Alias for the onboarding page
export const getUserOrganizations = query({
	args: { userId: v.string() },
	handler: async (ctx, args) => {
		// Handle both string ID and actual ID
		const memberships = await ctx.db
			.query("org_memberships")
			.collect();

		// Filter memberships for this user
		const userMemberships = memberships.filter(
			(m) => m.userId.toString() === args.userId
		);

		const orgs = await Promise.all(
			userMemberships.map((m) => ctx.db.get(m.orgId))
		);
		return orgs.filter(Boolean);
	},
});

export const listReposForOrg = query({
	args: { orgId: v.id("organizations"), onlyActive: v.optional(v.boolean()) },
	handler: async (ctx, args) => {
		let q = ctx.db.query("repositories").withIndex("by_org", (idx) => idx.eq("orgId", args.orgId));
		if (args.onlyActive) {
			q = q.filter((filter) => filter.eq(filter.field("isActive"), true));
		}
		return q.collect();
	},
});

export const getOrgSettings = query({
	args: { orgId: v.id("organizations") },
	handler: async (ctx, args) => {
		return ctx.db
			.query("org_settings")
			.withIndex("by_org", (q) => q.eq("orgId", args.orgId))
			.first();
	},
});

