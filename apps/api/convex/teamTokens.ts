import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const now = () => Date.now();

/**
 * Generate a secure random token (browser-compatible)
 */
function generateToken(): string {
	// Generate 32 random bytes using Web Crypto API
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	// Convert to base64url
	const base64 = btoa(String.fromCharCode(...bytes));
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Hash a token for storage (browser-compatible)
 */
async function hashToken(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new team token for MCP server authentication
 * Returns the raw token ONCE - it cannot be retrieved again
 */
export const createToken = mutation({
	args: {
		userId: v.id("users"),
		name: v.string(),
		createdBy: v.id("users"),
	},
	handler: async (ctx, args) => {
		// Generate the token
		const rawToken = generateToken();

		// Prefix with "mem_" to make it identifiable
		const token = `mem_${rawToken}`;

		// Hash the full token including prefix
		const tokenHashValue = await hashToken(token);

		const tokenId = await ctx.db.insert("team_tokens", {
			userId: args.userId,
			name: args.name,
			tokenHash: tokenHashValue,
			lastUsedAt: null,
			createdBy: args.createdBy,
			createdAt: now(),
			revokedAt: null,
		});

		// Return the raw token - this is the only time it will be visible
		return {
			tokenId,
			token, // Raw token for user to copy
		};
	},
});

/**
 * Revoke a team token
 */
export const revokeToken = mutation({
	args: {
		tokenId: v.id("team_tokens"),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db.get(args.tokenId);
		if (!existing) {
			throw new Error("Token not found");
		}

		if (existing.revokedAt) {
			throw new Error("Token already revoked");
		}

		await ctx.db.patch(args.tokenId, {
			revokedAt: now(),
		});

		return { success: true };
	},
});

/**
 * List all tokens for a user (without exposing the actual tokens)
 */
export const listTokens = query({
	args: {
		userId: v.id("users"),
		includeRevoked: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const tokens = await ctx.db
			.query("team_tokens")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();

		// Filter out revoked unless requested
		const filtered = args.includeRevoked
			? tokens
			: tokens.filter((t) => t.revokedAt === null);

		// Fetch creator info and format response (without tokenHash)
		const result = await Promise.all(
			filtered.map(async (t) => {
				const creator = await ctx.db.get(t.createdBy);
				return {
					_id: t._id,
					name: t.name,
					createdAt: t.createdAt,
					lastUsedAt: t.lastUsedAt,
					revokedAt: t.revokedAt,
					creatorName: creator?.name || creator?.email || "Unknown",
					// Show masked version: mem_****...****
					maskedToken: "mem_" + "•".repeat(8) + "..." + "•".repeat(8),
				};
			})
		);

		// Sort by creation date (newest first)
		result.sort((a, b) => b.createdAt - a.createdAt);

		return result;
	},
});

/**
 * Validate a token and return the associated user
 * Used by API routes to authenticate MCP server requests
 */
export const validateToken = query({
	args: {
		token: v.string(),
	},
	handler: async (ctx, args) => {
		// Hash the provided token
		const tokenHashValue = await hashToken(args.token);

		// Look up by hash
		const tokenRecord = await ctx.db
			.query("team_tokens")
			.withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHashValue))
			.first();

		if (!tokenRecord) {
			return { valid: false, error: "Invalid token" };
		}

		if (tokenRecord.revokedAt) {
			return { valid: false, error: "Token has been revoked" };
		}

		// Get the user
		const user = await ctx.db.get(tokenRecord.userId);
		if (!user) {
			return { valid: false, error: "User not found" };
		}

		return {
			valid: true,
			userId: tokenRecord.userId,
			userName: user.name,
			userEmail: user.email,
			tokenId: tokenRecord._id,
		};
	},
});

/**
 * Update last used timestamp for a token
 * Called after successful validation
 */
export const updateTokenLastUsed = mutation({
	args: {
		tokenId: v.id("team_tokens"),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.tokenId, {
			lastUsedAt: now(),
		});
		return { success: true };
	},
});

/**
 * Get token stats for a user
 */
export const getTokenStats = query({
	args: {
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const tokens = await ctx.db
			.query("team_tokens")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();

		const active = tokens.filter((t) => t.revokedAt === null);
		const revoked = tokens.filter((t) => t.revokedAt !== null);

		// Recently used (in last 7 days)
		const sevenDaysAgo = now() - 7 * 24 * 60 * 60 * 1000;
		const recentlyUsed = active.filter(
			(t) => t.lastUsedAt && t.lastUsedAt > sevenDaysAgo
		);

		// Never used
		const neverUsed = active.filter((t) => t.lastUsedAt === null);

		return {
			total: tokens.length,
			active: active.length,
			revoked: revoked.length,
			recentlyUsed: recentlyUsed.length,
			neverUsed: neverUsed.length,
		};
	},
});
