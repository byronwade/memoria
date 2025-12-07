import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const now = () => Date.now();

/**
 * Register a new device (called when MCP server starts without a linked device)
 * Returns the device ID for the CLI to store
 */
export const registerDevice = mutation({
	args: {
		deviceId: v.string(),
		deviceName: v.optional(v.string()),
		hostname: v.optional(v.string()),
		platform: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Check if device already exists
		const existing = await ctx.db
			.query("devices")
			.withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
			.first();

		if (existing) {
			// Update last seen and return existing
			await ctx.db.patch(existing._id, {
				lastSeenAt: now(),
				hostname: args.hostname || existing.hostname,
				platform: args.platform || existing.platform,
			});
			return {
				deviceDbId: existing._id,
				status: existing.status,
				userId: existing.userId,
			};
		}

		// Create new device in pending state
		const deviceDbId = await ctx.db.insert("devices", {
			deviceId: args.deviceId,
			userId: undefined,
			deviceName: args.deviceName,
			hostname: args.hostname,
			platform: args.platform,
			status: "pending",
			lastSeenAt: now(),
			createdAt: now(),
		});

		return {
			deviceDbId,
			status: "pending",
			userId: undefined,
		};
	},
});

/**
 * Link a device to a user account (called from web app after OAuth)
 */
export const linkDevice = mutation({
	args: {
		deviceId: v.string(),
		userId: v.id("users"),
		deviceName: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Find the device
		const device = await ctx.db
			.query("devices")
			.withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
			.first();

		if (!device) {
			throw new Error("Device not found. Please run 'memoria login' first.");
		}

		if (device.status === "revoked") {
			throw new Error("Device has been revoked. Please run 'memoria login' again.");
		}

		if (device.status === "linked" && device.userId) {
			// Check if linking to same user
			if (device.userId === args.userId) {
				return { success: true, alreadyLinked: true };
			}
			throw new Error("Device is already linked to another account.");
		}

		// Link the device
		await ctx.db.patch(device._id, {
			userId: args.userId,
			status: "linked",
			deviceName: args.deviceName || device.deviceName,
			lastSeenAt: now(),
		});

		return { success: true, alreadyLinked: false };
	},
});

/**
 * Get device status (called by CLI to check if linking is complete)
 */
export const getDeviceStatus = query({
	args: {
		deviceId: v.string(),
	},
	handler: async (ctx, args) => {
		const device = await ctx.db
			.query("devices")
			.withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
			.first();

		if (!device) {
			return { found: false };
		}

		let user = null;
		if (device.userId) {
			const userRecord = await ctx.db.get(device.userId);
			if (userRecord) {
				user = {
					id: device.userId,
					email: userRecord.email,
					name: userRecord.name,
				};
			}
		}

		return {
			found: true,
			status: device.status,
			user,
			deviceName: device.deviceName,
			lastSeenAt: device.lastSeenAt,
			createdAt: device.createdAt,
		};
	},
});

/**
 * Validate a device and return the associated user
 * Used by API routes to authenticate MCP server requests
 */
export const validateDevice = query({
	args: {
		deviceId: v.string(),
	},
	handler: async (ctx, args) => {
		const device = await ctx.db
			.query("devices")
			.withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
			.first();

		if (!device) {
			return { valid: false, error: "Device not registered" };
		}

		if (device.status === "revoked") {
			return { valid: false, error: "Device has been revoked" };
		}

		if (device.status === "pending" || !device.userId) {
			return { valid: false, error: "Device not linked to an account", status: "pending" };
		}

		// Get the user
		const user = await ctx.db.get(device.userId);
		if (!user) {
			return { valid: false, error: "User not found" };
		}

		return {
			valid: true,
			userId: device.userId,
			userName: user.name,
			userEmail: user.email,
			deviceId: device.deviceId,
			deviceDbId: device._id,
		};
	},
});

/**
 * Update device last seen timestamp
 * Called after successful API requests
 */
export const updateDeviceLastSeen = mutation({
	args: {
		deviceId: v.string(),
	},
	handler: async (ctx, args) => {
		const device = await ctx.db
			.query("devices")
			.withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
			.first();

		if (device) {
			await ctx.db.patch(device._id, {
				lastSeenAt: now(),
			});
		}

		return { success: true };
	},
});

/**
 * List all devices for a user
 */
export const listDevices = query({
	args: {
		userId: v.id("users"),
		includeRevoked: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const devices = await ctx.db
			.query("devices")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();

		// Filter out revoked unless requested
		const filtered = args.includeRevoked
			? devices
			: devices.filter((d) => d.status !== "revoked");

		// Sort by last seen (most recent first)
		filtered.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));

		return filtered.map((d) => ({
			_id: d._id,
			deviceId: d.deviceId.substring(0, 8) + "..." + d.deviceId.substring(d.deviceId.length - 4),
			deviceName: d.deviceName,
			hostname: d.hostname,
			platform: d.platform,
			status: d.status,
			lastSeenAt: d.lastSeenAt,
			createdAt: d.createdAt,
		}));
	},
});

/**
 * Revoke a device
 */
export const revokeDevice = mutation({
	args: {
		deviceDbId: v.id("devices"),
	},
	handler: async (ctx, args) => {
		const device = await ctx.db.get(args.deviceDbId);
		if (!device) {
			throw new Error("Device not found");
		}

		await ctx.db.patch(args.deviceDbId, {
			status: "revoked",
		});

		return { success: true };
	},
});

/**
 * Unlink a device (reset to pending state)
 */
export const unlinkDevice = mutation({
	args: {
		deviceDbId: v.id("devices"),
	},
	handler: async (ctx, args) => {
		const device = await ctx.db.get(args.deviceDbId);
		if (!device) {
			throw new Error("Device not found");
		}

		await ctx.db.patch(args.deviceDbId, {
			userId: undefined,
			status: "pending",
		});

		return { success: true };
	},
});

/**
 * Get device stats for a user
 */
export const getDeviceStats = query({
	args: {
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const devices = await ctx.db
			.query("devices")
			.withIndex("by_userId", (q) => q.eq("userId", args.userId))
			.collect();

		const linked = devices.filter((d) => d.status === "linked");
		const revoked = devices.filter((d) => d.status === "revoked");

		// Recently active (in last 24 hours)
		const oneDayAgo = now() - 24 * 60 * 60 * 1000;
		const recentlyActive = linked.filter(
			(d) => d.lastSeenAt && d.lastSeenAt > oneDayAgo
		);

		// Stale (not seen in 7 days)
		const sevenDaysAgo = now() - 7 * 24 * 60 * 60 * 1000;
		const stale = linked.filter(
			(d) => !d.lastSeenAt || d.lastSeenAt < sevenDaysAgo
		);

		return {
			total: devices.length,
			linked: linked.length,
			revoked: revoked.length,
			recentlyActive: recentlyActive.length,
			stale: stale.length,
		};
	},
});
