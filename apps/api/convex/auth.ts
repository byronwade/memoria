import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const now = () => Date.now();

// Helper for creating union of literals
const literals = <T extends string>(...values: T[]) =>
	v.union(...values.map((val) => v.literal(val))) as ReturnType<typeof v.literal<T>>;

const providerValidator = literals("github", "gitlab");
const roleValidator = literals("user", "admin", "support");
const ownerTypeValidator = literals("user", "organization");

export const upsertUserWithIdentity = mutation({
	args: {
		email: v.string(),
		emailVerified: v.boolean(),
		name: v.union(v.string(), v.null()),
		avatarUrl: v.union(v.string(), v.null()),
		provider: providerValidator,
		providerUserId: v.string(),
		accessToken: v.union(v.string(), v.null()),
		refreshToken: v.union(v.string(), v.null()),
		expiresAt: v.union(v.number(), v.null()),
		metadata: v.union(v.any(), v.null()),
		role: v.optional(roleValidator),
	},
	handler: async (ctx, args) => {
		const existingIdentity = await ctx.db
			.query("identities")
			.withIndex("by_provider_user", (q) =>
				q.eq("provider", args.provider).eq("providerUserId", args.providerUserId),
			)
			.first();

		const emailLower = args.email.toLowerCase();
		let user =
			(existingIdentity && (await ctx.db.get(existingIdentity.userId))) ??
			(await ctx.db
				.query("users")
				.withIndex("by_email", (q) => q.eq("email", emailLower))
				.first());

		if (user) {
			await ctx.db.patch(user._id, {
				email: emailLower,
				emailVerified: args.emailVerified,
				name: args.name,
				avatarUrl: args.avatarUrl,
				updatedAt: now(),
				role: args.role ?? user.role,
				githubUserId: args.provider === "github" ? args.providerUserId : user.githubUserId,
				gitlabUserId: args.provider === "gitlab" ? args.providerUserId : user.gitlabUserId,
			});
		} else {
			const userId = await ctx.db.insert("users", {
				email: emailLower,
				emailVerified: args.emailVerified,
				name: args.name,
				avatarUrl: args.avatarUrl,
				primaryOrgId: undefined,
				githubUserId: args.provider === "github" ? args.providerUserId : null,
				gitlabUserId: args.provider === "gitlab" ? args.providerUserId : null,
				role: args.role ?? "user",
				createdAt: now(),
				updatedAt: null,
			});
			user = await ctx.db.get(userId);
		}

		if (!user) {
			throw new Error("Failed to upsert user");
		}

		if (existingIdentity) {
			await ctx.db.patch(existingIdentity._id, {
				userId: user._id,
				accessToken: args.accessToken,
				refreshToken: args.refreshToken,
				expiresAt: args.expiresAt,
				metadata: args.metadata,
				updatedAt: now(),
			});
		} else {
			await ctx.db.insert("identities", {
				userId: user._id,
				provider: args.provider,
				providerUserId: args.providerUserId,
				accessToken: args.accessToken,
				refreshToken: args.refreshToken,
				expiresAt: args.expiresAt,
				metadata: args.metadata,
				createdAt: now(),
				updatedAt: null,
			});
		}

		return { userId: user._id };
	},
});

export const createSession = mutation({
	args: {
		userId: v.string(), // Accept string, will be normalized to Id
		sessionToken: v.string(),
		userAgent: v.union(v.string(), v.null()),
		ipAddress: v.union(v.string(), v.null()),
		expiresAt: v.number(),
	},
	handler: async (ctx, args) => {
		// Normalize userId to proper Convex Id format
		const userId = ctx.db.normalizeId("users", args.userId);
		if (!userId) {
			throw new Error("Invalid user ID");
		}
		const sessionId = await ctx.db.insert("sessions", {
			userId,
			sessionToken: args.sessionToken,
			userAgent: args.userAgent,
			ipAddress: args.ipAddress,
			expiresAt: args.expiresAt,
			createdAt: now(),
			revokedAt: null,
		});
		return { sessionId };
	},
});

export const revokeSession = mutation({
	args: { sessionToken: v.string(), revokedAt: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const session = await ctx.db
			.query("sessions")
			.withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
			.first();
		if (!session) return { revoked: false };
		await ctx.db.patch(session._id, { revokedAt: args.revokedAt ?? now() });
		return { revoked: true };
	},
});

export const getSession = query({
	args: { sessionToken: v.string() },
	handler: async (ctx, args) => {
		const session = await ctx.db
			.query("sessions")
			.withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
			.first();
		if (!session || session.revokedAt || session.expiresAt < now()) {
			return null;
		}
		const user = await ctx.db.get(session.userId);
		return user ? { session, user } : null;
	},
});

export const createApiToken = mutation({
	args: {
		name: v.string(),
		ownerType: ownerTypeValidator,
		userId: v.optional(v.id("users")),
		orgId: v.optional(v.id("organizations")),
		tokenHash: v.string(),
		scopes: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		const tokenId = await ctx.db.insert("api_tokens", {
			...args,
			lastUsedAt: null,
			createdAt: now(),
			revokedAt: null,
		});
		return { tokenId };
	},
});

export const touchApiToken = mutation({
	args: { tokenHash: v.string() },
	handler: async (ctx, args) => {
		const token = await ctx.db
			.query("api_tokens")
			.withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
			.first();
		if (!token) return { updated: false };
		await ctx.db.patch(token._id, { lastUsedAt: now() });
		return { updated: true };
	},
});

export const getUserByGitHubId = query({
	args: { githubUserId: v.string() },
	handler: async (ctx, args) => {
		return ctx.db
			.query("users")
			.withIndex("by_githubUserId", (q) => q.eq("githubUserId", args.githubUserId))
			.first();
	},
});

