/**
 * Convex Client for MCP Server
 *
 * Handles communication with the Convex backend for paid features:
 * - Team token validation
 * - Memory retrieval and storage
 * - Guardrails checking
 *
 * FREE TIER: Works without this (local git analysis only)
 * PAID TIER: Requires MEMORIA_API_URL environment variable
 */

export interface TokenValidationResult {
	valid: boolean;
	orgId?: string;
	orgName?: string;
	orgSlug?: string;
	tokenId?: string;
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
 * Memoria Cloud Client
 * Connects MCP server to the Convex backend
 */
export class MemoriaCloudClient {
	private apiUrl: string;
	private token: string | null = null;
	private cachedValidation: TokenValidationResult | null = null;
	private validationExpiry = 0;

	constructor(apiUrl?: string) {
		// Use environment variable or default to production
		this.apiUrl = apiUrl || process.env.MEMORIA_API_URL || "";
	}

	/**
	 * Check if cloud features are available
	 */
	isConfigured(): boolean {
		return !!this.apiUrl;
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
	 * Validate the current token
	 * Caches result for 5 minutes
	 */
	async validateToken(): Promise<TokenValidationResult> {
		if (!this.token) {
			return { valid: false, error: "No token set" };
		}

		if (!this.isConfigured()) {
			return { valid: false, error: "Cloud features not configured. Set MEMORIA_API_URL." };
		}

		// Return cached result if still valid
		if (this.cachedValidation && Date.now() < this.validationExpiry) {
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

			// Cache for 5 minutes
			this.cachedValidation = result;
			this.validationExpiry = Date.now() + 5 * 60 * 1000;

			return result;
		} catch (error: any) {
			return { valid: false, error: `Network error: ${error.message}` };
		}
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
			const params = new URLSearchParams({
				filePath,
				orgId: validation.orgId!,
			});
			if (repoId) params.append("repoId", repoId);
			if (queryKeywords?.length) params.append("keywords", queryKeywords.join(","));

			const response = await fetch(
				`${this.apiUrl}/api/mcp/memories?${params.toString()}`,
				{
					method: "GET",
					headers: {
						Authorization: `Bearer ${this.token}`,
					},
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
			const response = await fetch(`${this.apiUrl}/api/mcp/memories`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.token}`,
				},
				body: JSON.stringify({
					...input,
					orgId: validation.orgId, // Use org from token
				}),
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
			const params = new URLSearchParams({
				filePath,
				orgId: validation.orgId!,
			});
			if (repoId) params.append("repoId", repoId);

			const response = await fetch(
				`${this.apiUrl}/api/mcp/guardrails?${params.toString()}`,
				{
					method: "GET",
					headers: {
						Authorization: `Bearer ${this.token}`,
					},
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
