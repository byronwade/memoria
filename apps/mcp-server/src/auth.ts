/**
 * Shared Authentication Module
 *
 * Handles device-based authentication for both CLI and MCP server:
 * - Device ID generation and storage (~/.memoria/device.json)
 * - Browser-based OAuth flow
 * - Polling for device linking completion
 */

import { exec } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ============================================================================
// Constants
// ============================================================================

export const MEMORIA_DIR = path.join(os.homedir(), ".memoria");
export const DEVICE_FILE = path.join(MEMORIA_DIR, "device.json");
export const MEMORIA_WEB_URL = process.env.MEMORIA_WEB_URL || "https://memoria.byronwade.com";
export const MEMORIA_API_URL = process.env.MEMORIA_API_URL || "https://memoria.byronwade.com/api";

// ============================================================================
// Types
// ============================================================================

export interface DeviceInfo {
	deviceId: string;
	deviceName?: string;
	hostname: string;
	platform: string;
	createdAt: number;
	linkedAt?: number;
	userId?: string;
	userEmail?: string;
}

export interface DeviceLinkResult {
	linked: boolean;
	email?: string;
	error?: string;
}

// ============================================================================
// Device Management
// ============================================================================

/**
 * Generate a unique device ID using UUID v4
 */
function generateDeviceId(): string {
	return crypto.randomUUID();
}

/**
 * Get or create device info
 */
export function getOrCreateDevice(): DeviceInfo {
	// Ensure .memoria directory exists
	if (!fs.existsSync(MEMORIA_DIR)) {
		fs.mkdirSync(MEMORIA_DIR, { recursive: true });
	}

	// Check for existing device file
	if (fs.existsSync(DEVICE_FILE)) {
		try {
			const content = fs.readFileSync(DEVICE_FILE, "utf8");
			return JSON.parse(content) as DeviceInfo;
		} catch {
			// File corrupted, regenerate
		}
	}

	// Create new device
	const device: DeviceInfo = {
		deviceId: generateDeviceId(),
		hostname: os.hostname(),
		platform: process.platform,
		createdAt: Date.now(),
	};

	fs.writeFileSync(DEVICE_FILE, JSON.stringify(device, null, 2));
	return device;
}

/**
 * Update device info after successful linking
 */
export function updateDeviceInfo(updates: Partial<DeviceInfo>): void {
	const device = getOrCreateDevice();
	const updated = { ...device, ...updates };
	fs.writeFileSync(DEVICE_FILE, JSON.stringify(updated, null, 2));
}

/**
 * Get current device info (if exists)
 */
export function getDeviceInfo(): DeviceInfo | null {
	if (!fs.existsSync(DEVICE_FILE)) {
		return null;
	}
	try {
		const content = fs.readFileSync(DEVICE_FILE, "utf8");
		return JSON.parse(content) as DeviceInfo;
	} catch {
		return null;
	}
}

/**
 * Clear device info (for logout)
 */
export function clearDeviceInfo(): void {
	if (fs.existsSync(DEVICE_FILE)) {
		const device = getDeviceInfo();
		if (device) {
			// Keep device ID but clear linking info
			const cleared: DeviceInfo = {
				deviceId: device.deviceId,
				hostname: device.hostname,
				platform: device.platform,
				createdAt: device.createdAt,
			};
			fs.writeFileSync(DEVICE_FILE, JSON.stringify(cleared, null, 2));
		}
	}
}

/**
 * Check if device is linked to an account
 */
export function isDeviceLinked(): boolean {
	const device = getDeviceInfo();
	return !!(device?.linkedAt && device?.deviceId);
}

// ============================================================================
// Browser Utilities
// ============================================================================

/**
 * Open URL in default browser
 */
export function openBrowser(url: string): Promise<boolean> {
	return new Promise((resolve) => {
		const cmd = process.platform === "darwin"
			? `open "${url}"`
			: process.platform === "win32"
				? `start "${url}"`
				: `xdg-open "${url}"`;

		exec(cmd, (err) => {
			if (err) {
				resolve(false);
			} else {
				resolve(true);
			}
		});
	});
}

// ============================================================================
// Device Registration & Polling
// ============================================================================

/**
 * Register device with Memoria cloud and poll for linking completion
 */
export async function registerAndPollDevice(
	device: DeviceInfo,
	options?: { maxAttempts?: number; pollInterval?: number; onPoll?: (attempt: number) => void }
): Promise<DeviceLinkResult> {
	const maxAttempts = options?.maxAttempts ?? 150; // 5 minutes at 2s intervals
	const pollInterval = options?.pollInterval ?? 2000;

	// Register device
	try {
		const registerUrl = `${MEMORIA_API_URL}/devices/register`;
		const response = await fetch(registerUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				deviceId: device.deviceId,
				deviceName: device.deviceName || `${os.hostname()}'s Device`,
				hostname: device.hostname,
				platform: device.platform,
			}),
		});

		if (!response.ok) {
			const text = await response.text();
			return { linked: false, error: `Failed to register device: ${text}` };
		}
	} catch (err) {
		// If can't connect to cloud, return error
		return { linked: false, error: `Could not connect to Memoria cloud: ${(err as Error).message}` };
	}

	// Poll for linking status
	for (let i = 0; i < maxAttempts; i++) {
		await new Promise((resolve) => setTimeout(resolve, pollInterval));

		if (options?.onPoll) {
			options.onPoll(i + 1);
		}

		try {
			const statusUrl = `${MEMORIA_API_URL}/devices/status?deviceId=${device.deviceId}`;
			const response = await fetch(statusUrl);

			if (!response.ok) continue;

			const data = await response.json() as { status: string; user?: { email: string; name?: string } };

			if (data.status === "linked" && data.user) {
				// Update local device info
				updateDeviceInfo({
					linkedAt: Date.now(),
					userId: data.user.email,
					userEmail: data.user.email,
				});
				return { linked: true, email: data.user.email };
			}
		} catch {
			// Ignore polling errors, keep trying
		}
	}

	return { linked: false, error: "Linking timed out. Please try again." };
}

// ============================================================================
// High-Level Authentication
// ============================================================================

/**
 * Ensure device is authenticated before proceeding.
 * Opens browser for login if needed.
 * Returns true if authenticated, false if failed.
 */
export async function ensureAuthenticated(options?: {
	silent?: boolean;
	onStatus?: (status: string) => void;
}): Promise<{ authenticated: boolean; email?: string; error?: string }> {
	// Check if already linked
	const device = getDeviceInfo();
	if (device?.linkedAt && device?.deviceId) {
		// Validate with server
		try {
			const statusUrl = `${MEMORIA_API_URL}/devices/status?deviceId=${device.deviceId}`;
			const response = await fetch(statusUrl);

			if (response.ok) {
				const data = await response.json() as { status: string; user?: { email: string } };
				if (data.status === "linked" && data.user) {
					return { authenticated: true, email: data.user.email };
				}
			}
		} catch {
			// Can't reach server, but we have local link - proceed
			if (device.userEmail) {
				return { authenticated: true, email: device.userEmail };
			}
		}
	}

	// Not authenticated - need to login
	const newDevice = getOrCreateDevice();
	const linkUrl = `${MEMORIA_WEB_URL}/link?device=${newDevice.deviceId}`;

	// Open browser
	options?.onStatus?.("Opening browser for authentication...");
	const browserOpened = await openBrowser(linkUrl);

	if (!browserOpened && !options?.silent) {
		options?.onStatus?.(`Please open this URL to authenticate: ${linkUrl}`);
	}

	// Poll for completion
	options?.onStatus?.("Waiting for authentication...");
	const result = await registerAndPollDevice(newDevice, {
		onPoll: (attempt) => {
			if (attempt % 15 === 0) { // Every 30 seconds
				options?.onStatus?.("Still waiting for authentication...");
			}
		},
	});

	if (result.linked) {
		return { authenticated: true, email: result.email };
	}

	return { authenticated: false, error: result.error };
}
