/**
 * Convex Client for MCP Server
 *
 * Handles communication with the Convex backend for cloud features:
 * - Team token validation (paid teams)
 * - Device authentication (free tier)
 * - Memory retrieval and storage
 * - Guardrails checking
 *
 * AUTHENTICATION METHODS:
 * 1. Team Token: mem_xxx (for paid teams)
 * 2. Device ID: UUID from ~/.memoria/device.json (for free tier)
 *
 * FREE TIER: Works locally without this, OR with device linking for cloud memories
 * PAID TIER: Requires team token
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const MEMORIA_DIR = path.join(os.homedir(), ".memoria");
const DEVICE_FILE = path.join(MEMORIA_DIR, "device.json");

interface DeviceInfo {
	deviceId: string;
	deviceName?: string;
	hostname: string;
	platform: string;
	createdAt: number;
	linkedAt?: number;
	userId?: string;
	userEmail?: string;
}

export interface TokenValidationResult {
	valid: boolean;
	orgId?: string;
	orgName?: string;
	orgSlug?: string;
	tokenId?: string;
	userId?: string;
	userEmail?: string;
	authMethod?: "token" | "device";
	error?: string;
}

export interface Memory {
	_id: string;
	context: string;
	summary?: string;
	tags: string[];
	keywords?: string[];
	linkedFiles: string[];
	memoryType?: "lesson" | "context" | "decision" | "pattern" | "warning" | "todo";
	importance?: "critical" | "high" | "normal" | "low";
	createdAt: number;
}

export interface CreateMemoryInput {
	orgId: string;
	repoId?: string;
	context: string;
	summary?: string;
	tags?: string[];
	keywords?: string[];
	linkedFiles?: string[];
	memoryType?: "lesson" | "context" | "decision" | "pattern" | "warning" | "todo";
	importance?: "critical" | "high" | "normal" | "low";
	userId: string;
}

export interface Guardrail {
	_id: string;
	pattern: string;
	level: "warn" | "block";
	message: string;
	isEnabled: boolean;
}

/**
 * Load device info from ~/.memoria/device.json
 */
function loadDeviceInfo(): DeviceInfo | null {
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
 * Memoria Cloud Client
 * Connects MCP server to the Convex backend
 * Supports both token authentication (teams) and device authentication (free tier)
 */
export class MemoriaCloudClient {
	private apiUrl: string;
	private token: string | null = null;
	private deviceId: string | null = null;
	private cachedValidation: TokenValidationResult | null = null;
	private validationExpiry = 0;

	constructor(apiUrl?: string) {
		// Use provided apiUrl, environment variable, or default to production
		// Note: Empty string means explicitly not configured
		if (apiUrl !== undefined) {
			this.apiUrl = apiUrl;
		} else {
			this.apiUrl = process.env.MEMORIA_API_URL || "https://memoria.byronwade.com";
		}

		// Auto-load device ID from ~/.memoria/device.json
		const deviceInfo = loadDeviceInfo();
		if (deviceInfo?.linkedAt && deviceInfo?.deviceId) {
			this.deviceId = deviceInfo.deviceId;
		}
	}

	/**
	 * Check if cloud features are available
	 */
	isConfigured(): boolean {
		return !!this.apiUrl;
	}

	/**
	 * Check if we have any auth method available
	 */
	hasAuth(): boolean {
		return !!(this.token || this.deviceId);
	}

	/**
	 * Set the team token for authentication
	 */
	setToken(token: string): void {
		this.token = token;
		this.cachedValidation = null;
		this.validationExpiry = 0;
	}

	/**
	 * Set the device ID for authentication
	 */
	setDeviceId(deviceId: string): void {
		this.deviceId = deviceId;
		this.cachedValidation = null;
		this.validationExpiry = 0;
	}

	/**
	 * Validate credentials (token or device)
	 * Caches result for 5 minutes
	 */
	async validateToken(): Promise<TokenValidationResult> {
		// Prefer token auth if available
		if (this.token) {
			return this.validateTeamToken();
		}

		// Fall back to device auth
		if (this.deviceId) {
			return this.validateDevice();
		}

		return { valid: false, error: "No authentication configured. Run 'memoria login' or set a team token." };
	}

	/**
	 * Validate team token
	 */
	private async validateTeamToken(): Promise<TokenValidationResult> {
		if (!this.token) {
			return { valid: false, error: "No token set" };
		}

		if (!this.isConfigured()) {
			return { valid: false, error: "Cloud features not configured. Set MEMORIA_API_URL." };
		}

		// Return cached result if still valid
		if (this.cachedValidation && this.cachedValidation.authMethod === "token" && Date.now() < this.validationExpiry) {
			return this.cachedValidation;
		}

		try {
			const response = await fetch(`${this.apiUrl}/api/mcp/validate-token`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.token}`,
				},
				body: JSON.stringify({ token: this.token }),
			});

			if (!response.ok) {
				const error = await response.text();
				return { valid: false, error: `Validation failed: ${error}` };
			}

			const result = (await response.json()) as TokenValidationResult;
			result.authMethod = "token";

			// Cache for 5 minutes
			this.cachedValidation = result;
			this.validationExpiry = Date.now() + 5 * 60 * 1000;

			return result;
		} catch (error: any) {
			return { valid: false, error: `Network error: ${error.message}` };
		}
	}

	/**
	 * Validate device authentication
	 */
	private async validateDevice(): Promise<TokenValidationResult> {
		if (!this.deviceId) {
			return { valid: false, error: "No device ID set" };
		}

		if (!this.isConfigured()) {
			return { valid: false, error: "Cloud features not configured." };
		}

		// Return cached result if still valid
		if (this.cachedValidation && this.cachedValidation.authMethod === "device" && Date.now() < this.validationExpiry) {
			return this.cachedValidation;
		}

		try {
			const response = await fetch(`${this.apiUrl}/api/devices/validate`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ deviceId: this.deviceId }),
			});

			const data = await response.json() as {
				valid: boolean;
				error?: string;
				status?: string;
				userId?: string;
				userEmail?: string;
			};

			if (!data.valid) {
				if (data.status === "pending") {
					return { valid: false, error: "Device not linked. Run 'memoria login' to connect your account." };
				}
				return { valid: false, error: data.error || "Device validation failed" };
			}

			const result: TokenValidationResult = {
				valid: true,
				userId: data.userId,
				userEmail: data.userEmail,
				authMethod: "device",
			};

			// Cache for 5 minutes
			this.cachedValidation = result;
			this.validationExpiry = Date.now() + 5 * 60 * 1000;

			return result;
		} catch (error: any) {
			return { valid: false, error: `Network error: ${error.message}` };
		}
	}

	/**
	 * Get auth headers for requests
	 */
	private getAuthHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (this.token) {
			headers["Authorization"] = `Bearer ${this.token}`;
		} else if (this.deviceId) {
			headers["X-Device-Id"] = this.deviceId;
		}

		return headers;
	}

	/**
	 * Get memories for a file (searches by keywords and linked files)
	 */
	async getMemoriesForFile(
		filePath: string,
		queryKeywords?: string[],
		repoId?: string,
	): Promise<{ memories: Memory[]; error?: string }> {
		const validation = await this.validateToken();
		if (!validation.valid) {
			return { memories: [], error: validation.error };
		}

		try {
			const params = new URLSearchParams({ filePath });

			// Use orgId for token auth, userId for device auth
			if (validation.orgId) {
				params.append("orgId", validation.orgId);
			} else if (validation.userId) {
				params.append("userId", validation.userId);
			}

			if (repoId) params.append("repoId", repoId);
			if (queryKeywords?.length) params.append("keywords", queryKeywords.join(","));

			const response = await fetch(
				`${this.apiUrl}/api/mcp/memories?${params.toString()}`,
				{
					method: "GET",
					headers: this.getAuthHeaders(),
				},
			);

			if (!response.ok) {
				const error = await response.text();
				return { memories: [], error: `Failed to fetch memories: ${error}` };
			}

			const data = (await response.json()) as { memories?: Memory[] };
			return { memories: data.memories || [] };
		} catch (error: any) {
			return { memories: [], error: `Network error: ${error.message}` };
		}
	}

	/**
	 * Save a new memory
	 */
	async saveMemory(input: CreateMemoryInput): Promise<{ memoryId?: string; error?: string }> {
		const validation = await this.validateToken();
		if (!validation.valid) {
			return { error: validation.error };
		}

		try {
			// For device auth, we use the userId from validation
			const payload = {
				...input,
				orgId: validation.orgId || input.orgId,
				userId: validation.userId || input.userId,
			};

			const response = await fetch(`${this.apiUrl}/api/mcp/memories`, {
				method: "POST",
				headers: this.getAuthHeaders(),
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const error = await response.text();
				return { error: `Failed to save memory: ${error}` };
			}

			const data = (await response.json()) as { memoryId?: string };
			return { memoryId: data.memoryId };
		} catch (error: any) {
			return { error: `Network error: ${error.message}` };
		}
	}

	/**
	 * Get guardrails for a file path
	 */
	async getGuardrailsForFile(
		filePath: string,
		repoId?: string,
	): Promise<{ guardrails: Guardrail[]; error?: string }> {
		const validation = await this.validateToken();
		if (!validation.valid) {
			return { guardrails: [], error: validation.error };
		}

		try {
			const params = new URLSearchParams({ filePath });

			// Use orgId for token auth, userId for device auth
			if (validation.orgId) {
				params.append("orgId", validation.orgId);
			} else if (validation.userId) {
				params.append("userId", validation.userId);
			}

			if (repoId) params.append("repoId", repoId);

			const response = await fetch(
				`${this.apiUrl}/api/mcp/guardrails?${params.toString()}`,
				{
					method: "GET",
					headers: this.getAuthHeaders(),
				},
			);

			if (!response.ok) {
				const error = await response.text();
				return { guardrails: [], error: `Failed to fetch guardrails: ${error}` };
			}

			const data = (await response.json()) as { guardrails?: Guardrail[] };
			return { guardrails: data.guardrails || [] };
		} catch (error: any) {
			return { guardrails: [], error: `Network error: ${error.message}` };
		}
	}

	/**
	 * Check if a file path matches any blocking guardrails
	 */
	async checkGuardrails(
		filePath: string,
		repoId?: string,
	): Promise<{ allowed: boolean; warnings: string[]; blocks: string[] }> {
		const { guardrails, error } = await this.getGuardrailsForFile(filePath, repoId);

		if (error || guardrails.length === 0) {
			return { allowed: true, warnings: [], blocks: [] };
		}

		const warnings: string[] = [];
		const blocks: string[] = [];

		for (const rule of guardrails) {
			if (!rule.isEnabled) continue;

			// Convert glob pattern to regex
			const regex = globToRegex(rule.pattern);
			if (regex.test(filePath)) {
				if (rule.level === "block") {
					blocks.push(rule.message);
				} else {
					warnings.push(rule.message);
				}
			}
		}

		return {
			allowed: blocks.length === 0,
			warnings,
			blocks,
		};
	}
}

/**
 * Convert a glob pattern to a regex
 */
function globToRegex(glob: string): RegExp {
	const escaped = glob
		.replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape special chars
		.replace(/\*\*/g, ".*") // ** matches any path
		.replace(/\*/g, "[^/]*") // * matches any non-path chars
		.replace(/\?/g, "."); // ? matches single char

	return new RegExp(`^${escaped}$`);
}

// Singleton instance
let cloudClient: MemoriaCloudClient | null = null;

/**
 * Get or create the cloud client singleton
 */
export function getCloudClient(): MemoriaCloudClient {
	if (!cloudClient) {
		cloudClient = new MemoriaCloudClient();
	}
	return cloudClient;
}

/**
 * Initialize cloud client with a token (called when MCP server starts with token)
 */
export function initializeCloudClient(token: string, apiUrl?: string): MemoriaCloudClient {
	cloudClient = new MemoriaCloudClient(apiUrl);
	cloudClient.setToken(token);
	return cloudClient;
}
