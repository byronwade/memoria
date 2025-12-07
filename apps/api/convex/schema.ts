import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());
const nullableJson = v.union(v.any(), v.null());

// Helper for creating union of literals
const literals = <T extends string>(...values: T[]) =>
	v.union(...values.map((val) => v.literal(val))) as ReturnType<typeof v.literal<T>>;

export default defineSchema({
	users: defineTable({
		email: v.string(),
		emailVerified: v.boolean(),
		name: nullableString,
		avatarUrl: nullableString,
		githubUserId: nullableString,
		gitlabUserId: nullableString,
		role: literals("user", "admin", "support"),
		// Billing fields (moved from organizations)
		stripeCustomerId: v.optional(v.string()),
		stripeSubscriptionId: v.optional(v.string()),
		planTier: v.optional(literals("free", "pro", "team")),
		maxRepos: v.optional(v.number()),
		maxAnalysesPerMonth: v.optional(v.number()),
		subscriptionStatus: v.optional(literals("active", "trial", "past_due", "canceled", "suspended")),
		trialEndsAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_email", ["email"])
		.index("by_githubUserId", ["githubUserId"])
		.index("by_gitlabUserId", ["gitlabUserId"])
		.index("by_stripeCustomerId", ["stripeCustomerId"]),

	identities: defineTable({
		userId: v.id("users"),
		provider: literals("github", "gitlab", "email", "password", "other"),
		providerUserId: v.string(),
		accessToken: nullableString,
		refreshToken: nullableString,
		expiresAt: nullableNumber,
		metadata: nullableJson,
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_userId", ["userId"])
		.index("by_provider_user", ["provider", "providerUserId"]),

	sessions: defineTable({
		userId: v.id("users"),
		sessionToken: v.string(),
		userAgent: nullableString,
		ipAddress: nullableString,
		expiresAt: v.number(),
		createdAt: v.number(),
		revokedAt: nullableNumber,
	})
		.index("by_sessionToken", ["sessionToken"])
		.index("by_userId", ["userId"]),

	api_tokens: defineTable({
		name: v.string(),
		userId: v.id("users"),
		tokenHash: v.string(),
		scopes: v.array(v.string()),
		lastUsedAt: nullableNumber,
		createdAt: v.number(),
		revokedAt: nullableNumber,
	})
		.index("by_userId", ["userId"])
		.index("by_tokenHash", ["tokenHash"]),

	billing_plans: defineTable({
		name: v.string(),
		stripePriceId: nullableString,
		tier: literals("free", "pro", "team"),
		maxRepos: nullableNumber,
		maxAnalysesPerMonth: nullableNumber,
		pricePerMonthUsd: v.number(),
		features: v.array(v.string()),
		isPublic: v.boolean(),
		createdAt: v.number(),
		updatedAt: nullableNumber,
	}).index("by_tier", ["tier"]),

	billing_usage: defineTable({
		userId: v.id("users"),
		periodStart: v.number(),
		periodEnd: v.number(),
		prAnalysesCount: v.number(),
		reposActiveCount: v.number(),
		extraUsageMetadata: nullableJson,
		createdAt: v.number(),
	})
		.index("by_userId", ["userId"])
		.index("by_user_period", ["userId", "periodStart", "periodEnd"]),

	billing_events: defineTable({
		stripeEventId: v.string(),
		type: v.string(),
		payload: v.any(),
		processedAt: nullableNumber,
		createdAt: v.number(),
	}).index("by_stripeEventId", ["stripeEventId"]),

	scm_providers: defineTable({
		type: literals("github", "gitlab", "bitbucket", "other"),
		name: v.string(),
		apiBaseUrl: v.string(),
		webBaseUrl: v.string(),
		appId: nullableString,
		config: nullableJson,
		createdAt: v.number(),
		updatedAt: nullableNumber,
	}).index("by_type", ["type"]),

	scm_installations: defineTable({
		providerType: literals("github", "gitlab", "bitbucket", "other"),
		providerInstallationId: v.string(),
		userId: v.id("users"),
		accountType: literals("user", "org"),
		accountLogin: v.string(),
		accountName: nullableString,
		permissions: nullableJson,
		status: literals("active", "suspended", "deleted"),
		lastSyncedAt: nullableNumber,
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_userId", ["userId"])
		.index("by_providerInstallation", ["providerType", "providerInstallationId"]),

	repositories: defineTable({
		userId: v.id("users"),
		scmInstallationId: v.id("scm_installations"),
		providerType: literals("github", "gitlab", "bitbucket", "other"),
		providerRepoId: v.string(),
		fullName: v.string(),
		defaultBranch: v.string(),
		isPrivate: v.boolean(),
		isActive: v.boolean(),
		languageHint: nullableString,
		settings: nullableJson,
		lastAnalyzedAt: nullableNumber,
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_userId", ["userId"])
		.index("by_installation", ["scmInstallationId"])
		.index("by_provider_repo", ["providerType", "providerRepoId"])
		.index("by_fullName", ["providerType", "fullName"]),

	repository_sync_state: defineTable({
		repoId: v.id("repositories"),
		lastFullCloneAt: nullableNumber,
		lastFetchAt: nullableNumber,
		lastSyncStatus: literals("ok", "error", "pending"),
		lastSyncErrorMessage: nullableString,
		createdAt: v.number(),
		updatedAt: nullableNumber,
	}).index("by_repoId", ["repoId"]),

	pull_requests: defineTable({
		repoId: v.id("repositories"),
		providerType: literals("github", "gitlab", "bitbucket", "other"),
		providerPullRequestId: v.string(),
		number: v.number(),
		title: v.string(),
		body: nullableString,
		state: literals("open", "closed", "merged"),
		isDraft: v.boolean(),
		authorProviderUserId: v.string(),
		authorLogin: v.string(),
		sourceBranch: v.string(),
		targetBranch: v.string(),
		createdAtProvider: v.number(),
		updatedAtProvider: nullableNumber,
		mergedAtProvider: nullableNumber,
		closedAtProvider: nullableNumber,
		lastAnalyzedAt: nullableNumber,
		lastAnalysisId: v.optional(v.id("analyses")),
		labels: v.array(v.string()),
		metadata: nullableJson,
	})
		.index("by_repo_number", ["repoId", "number"])
		.index("by_repo_state", ["repoId", "state"])
		.index("by_providerId", ["providerType", "providerPullRequestId"]),

	commits: defineTable({
		repoId: v.id("repositories"),
		providerType: literals("github", "gitlab", "bitbucket", "other"),
		providerCommitSha: v.string(),
		authorName: v.string(),
		authorEmail: v.string(),
		message: v.string(),
		committedAt: v.number(),
		metadata: nullableJson,
	}).index("by_repo_sha", ["repoId", "providerCommitSha"]),

	pull_request_engagement: defineTable({
		pullRequestId: v.id("pull_requests"),
		providerType: literals("github", "gitlab", "bitbucket", "other"),
		type: literals("comment", "review", "approval", "request_changes"),
		providerEventId: v.string(),
		actorProviderUserId: v.string(),
		actorLogin: v.string(),
		body: nullableString,
		createdAtProvider: v.number(),
		metadata: nullableJson,
	})
		.index("by_pullRequest", ["pullRequestId"])
		.index("by_providerEvent", ["providerType", "providerEventId"]),

	analyses: defineTable({
		userId: v.id("users"),
		repoId: v.id("repositories"),
		pullRequestId: v.optional(v.id("pull_requests")),
		commitSha: nullableString,
		analysisType: literals("pull_request", "commit", "manual"),
		engineVersion: v.string(),
		riskLevel: literals("low", "medium", "high", "informational"),
		score: nullableNumber,
		changedFiles: v.array(v.string()),
		missingCoChangedFiles: v.array(
			v.object({
				file: v.string(),
				probability: v.number(),
			}),
		),
		suggestedTests: v.array(v.string()),
		summary: v.string(),
		rawResult: v.any(),
		commentPosted: v.boolean(),
		commentUrl: nullableString,
		createdAt: v.number(),
		durationMs: nullableNumber,
	})
		.index("by_userId", ["userId"])
		.index("by_repo", ["repoId"])
		.index("by_pullRequest", ["pullRequestId"])
		.index("by_repo_createdAt", ["repoId", "createdAt"]),

	analysis_findings: defineTable({
		analysisId: v.id("analyses"),
		kind: literals(
			"co_change_missing",
			"hotspot_file",
			"test_missing",
			"config_warning",
			"other",
		),
		severity: literals("low", "medium", "high"),
		filePath: nullableString,
		details: v.string(),
		data: nullableJson,
		createdAt: v.number(),
	})
		.index("by_analysis", ["analysisId"])
		.index("by_filePath", ["filePath"]),

	events: defineTable({
		userId: v.optional(v.id("users")),
		repoId: v.optional(v.id("repositories")),
		pullRequestId: v.optional(v.id("pull_requests")),
		type: v.string(),
		context: nullableJson,
		createdAt: v.number(),
	})
		.index("by_userId_type", ["userId", "type"])
		.index("by_repo_type", ["repoId", "type"])
		.index("by_type_createdAt", ["type", "createdAt"]),

	daily_user_stats: defineTable({
		userId: v.id("users"),
		date: v.string(),
		prAnalysesCount: v.number(),
		highRiskAnalysesCount: v.number(),
		mediumRiskAnalysesCount: v.number(),
		lowRiskAnalysesCount: v.number(),
		averageRiskScore: nullableNumber,
		reposActiveCount: v.number(),
		createdAt: v.number(),
	}).index("by_user_date", ["userId", "date"]),

	daily_repo_stats: defineTable({
		repoId: v.id("repositories"),
		date: v.string(),
		prAnalysesCount: v.number(),
		highRiskAnalysesCount: v.number(),
		mediumRiskAnalysesCount: v.number(),
		lowRiskAnalysesCount: v.number(),
		averageRiskScore: nullableNumber,
		createdAt: v.number(),
	}).index("by_repo_date", ["repoId", "date"]),

	file_risk_stats: defineTable({
		repoId: v.id("repositories"),
		filePath: v.string(),
		highRiskCount: v.number(),
		mediumRiskCount: v.number(),
		lowRiskCount: v.number(),
		totalAnalysesTouching: v.number(),
		lastTouchedAt: nullableNumber,
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_repo_file", ["repoId", "filePath"])
		.index("by_repo_highRisk", ["repoId", "highRiskCount"]),

	// Repository Scans - tracks full repository scan jobs
	repository_scans: defineTable({
		repositoryId: v.id("repositories"),
		status: literals("pending", "running", "completed", "failed"),
		triggeredBy: literals("onboarding", "manual", "scheduled"),
		startedAt: nullableNumber,
		completedAt: nullableNumber,
		errorMessage: nullableString,
		totalFiles: v.number(),
		processedFiles: v.number(),
		filesWithRisk: v.number(),
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_repository", ["repositoryId"])
		.index("by_status", ["status"])
		.index("by_repository_status", ["repositoryId", "status"]),

	// File Analyses - stores per-file analysis results from scans
	file_analyses: defineTable({
		scanId: v.id("repository_scans"),
		repositoryId: v.id("repositories"),
		filePath: v.string(),
		riskScore: v.number(), // 0-100
		riskLevel: literals("low", "medium", "high", "critical"),
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
		lastAnalyzedAt: v.number(),
		createdAt: v.number(),
	})
		.index("by_scan", ["scanId"])
		.index("by_repository", ["repositoryId"])
		.index("by_repository_file", ["repositoryId", "filePath"])
		.index("by_repository_risk", ["repositoryId", "riskScore"]),

	inbound_webhooks: defineTable({
		source: literals("github", "gitlab", "stripe", "bitbucket", "other"),
		externalEventId: v.string(),
		eventType: v.string(),
		payload: v.any(),
		processedAt: nullableNumber,
		processingStatus: literals("pending", "processed", "error"),
		errorMessage: nullableString,
		createdAt: v.number(),
	})
		.index("by_source_eventId", ["source", "externalEventId"])
		.index("by_status", ["processingStatus"]),

	outbound_webhooks: defineTable({
		userId: v.id("users"),
		targetType: literals("slack", "webhook", "other"),
		targetUrl: v.string(),
		eventType: v.string(),
		payload: v.any(),
		status: literals("pending", "sent", "error"),
		lastAttemptAt: nullableNumber,
		attemptCount: v.number(),
		errorMessage: nullableString,
		createdAt: v.number(),
	})
		.index("by_user_status", ["userId", "status"]),

	feature_flags: defineTable({
		key: v.string(),
		description: nullableString,
		isGlobal: v.boolean(),
		defaultEnabled: v.boolean(),
		createdAt: v.number(),
		updatedAt: nullableNumber,
	}).index("by_key", ["key"]),

	user_feature_overrides: defineTable({
		userId: v.id("users"),
		featureKey: v.string(),
		enabled: v.boolean(),
		createdAt: v.number(),
		updatedAt: nullableNumber,
	}).index("by_user_feature", ["userId", "featureKey"]),

	gitlab_instances: defineTable({
		scmProviderId: v.id("scm_providers"),
		baseUrl: v.string(),
		name: v.string(),
		createdAt: v.number(),
		updatedAt: nullableNumber,
	}).index("by_baseUrl", ["baseUrl"]),

	// ===========================================
	// AI CONTROL PLANE TABLES
	// ===========================================

	// Guardrails - Rules that protect files/paths from AI modifications
	guardrails: defineTable({
		userId: v.id("users"),
		repoId: v.optional(v.id("repositories")), // null = user-wide default
		pattern: v.string(), // glob pattern (e.g., "src/auth/**", "*.env")
		level: literals("warn", "block"),
		message: v.string(), // reasoning shown to AI/developer
		isEnabled: v.boolean(),
		createdBy: v.id("users"),
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_userId", ["userId"])
		.index("by_repo", ["repoId"])
		.index("by_user_enabled", ["userId", "isEnabled"]),

	// Memories - Human context/knowledge for AI to consider (Enhanced for Tri-Layer Brain)
	memories: defineTable({
		userId: v.id("users"),
		repoId: v.optional(v.id("repositories")), // null = user-wide
		context: v.string(), // the actual knowledge/context
		summary: v.optional(v.string()), // Auto-generated 1-line summary
		tags: v.array(v.string()), // for filtering (e.g., ["auth", "critical"])
		keywords: v.optional(v.array(v.string())), // For BM25 matching
		linkedFiles: v.array(v.string()), // file paths this applies to
		memoryType: v.optional(
			literals("lesson", "context", "decision", "pattern", "warning", "todo"),
		),
		source: v.optional(
			v.object({
				type: literals("manual", "pr_comment", "commit_message", "auto_extracted"),
				reference: nullableString, // commit hash, PR URL, etc.
			}),
		),
		importance: v.optional(literals("critical", "high", "normal", "low")),
		accessCount: v.optional(v.number()),
		lastAccessedAt: nullableNumber,
		createdBy: v.id("users"),
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_userId", ["userId"])
		.index("by_repo", ["repoId"])
		.index("by_user_importance", ["userId", "importance"])
		.index("by_user_type", ["userId", "memoryType"]),

	// Interventions - Log when MCP enforces a guardrail
	interventions: defineTable({
		userId: v.id("users"),
		repoId: v.id("repositories"),
		guardrailId: v.optional(v.id("guardrails")), // which rule triggered
		filePath: v.string(),
		action: literals("blocked", "warned"),
		aiTool: v.string(), // "cursor", "claude-code", "windsurf", "cline"
		aiModel: nullableString, // "claude-3.5-sonnet", "gpt-4"
		context: nullableString, // what AI was trying to do
		timestamp: v.number(),
	})
		.index("by_userId", ["userId"])
		.index("by_repo", ["repoId"])
		.index("by_user_timestamp", ["userId", "timestamp"])
		.index("by_guardrail", ["guardrailId"]),

	// Team Tokens - Auth tokens for MCP servers to fetch config
	team_tokens: defineTable({
		userId: v.id("users"),
		name: v.string(), // e.g., "Production MCP", "CI/CD"
		tokenHash: v.string(), // SHA-256 hash of actual token
		lastUsedAt: nullableNumber,
		createdBy: v.id("users"),
		createdAt: v.number(),
		revokedAt: nullableNumber,
	})
		.index("by_userId", ["userId"])
		.index("by_tokenHash", ["tokenHash"]),

	// Devices - CLI/MCP device authentication for free tier
	devices: defineTable({
		deviceId: v.string(), // unique device identifier (UUID)
		userId: v.optional(v.id("users")), // linked user (null until linked)
		deviceName: v.optional(v.string()), // e.g., "Byron's MacBook"
		hostname: v.optional(v.string()), // machine hostname
		platform: v.optional(v.string()), // darwin, linux, win32
		status: literals("pending", "linked", "revoked"),
		lastSeenAt: v.optional(v.number()),
		createdAt: v.number(),
	})
		.index("by_deviceId", ["deviceId"])
		.index("by_userId", ["userId"])
		.index("by_status", ["status"]),

	// ===========================================
	// TRI-LAYER BRAIN: CODE GRAPH
	// ===========================================

	// Code Files - Nodes in the code graph (files with their exports/imports)
	code_files: defineTable({
		repoId: v.id("repositories"),
		filePath: v.string(),
		language: v.string(), // ts, js, py, go, etc.
		exports: v.array(
			v.object({
				name: v.string(),
				kind: literals("function", "class", "const", "type", "interface", "variable"),
				signature: v.optional(v.string()), // function signature if available
				line: v.number(),
			}),
		),
		imports: v.array(
			v.object({
				source: v.string(), // the import path
				specifiers: v.array(v.string()), // what's imported
				isRelative: v.boolean(), // ./foo vs lodash
			}),
		),
		keywords: v.array(v.string()), // For BM25 matching
		riskScore: v.number(), // 0-100 compound risk
		lastIndexedAt: v.number(),
		createdAt: v.number(),
	})
		.index("by_repo", ["repoId"])
		.index("by_repo_path", ["repoId", "filePath"])
		.index("by_repo_risk", ["repoId", "riskScore"]),

	// Code Relationships - Edges in the code graph
	code_relationships: defineTable({
		repoId: v.id("repositories"),
		sourceFileId: v.id("code_files"),
		targetFileId: v.id("code_files"),
		type: literals("imports", "co_changes", "tests", "types", "transitive"),
		strength: v.number(), // 0-100 coupling strength
		evidence: v.optional(v.string()), // brief description of why coupled
		createdAt: v.number(),
		updatedAt: nullableNumber,
	})
		.index("by_source", ["sourceFileId"])
		.index("by_target", ["targetFileId"])
		.index("by_repo", ["repoId"])
		.index("by_repo_type", ["repoId", "type"]),

	// ===========================================
	// TRI-LAYER BRAIN: TEMPORAL GRAPH
	// ===========================================

	// Commit Index - Searchable commit history with panic scores
	commit_index: defineTable({
		repoId: v.id("repositories"),
		commitHash: v.string(),
		message: v.string(),
		authorEmail: v.string(),
		authorName: v.string(),
		committedAt: v.number(),
		commitType: literals("bugfix", "feature", "refactor", "docs", "chore", "unknown"),
		panicScore: v.number(), // 0-100 based on keywords (security, hotfix, revert, etc.)
		keywords: v.array(v.string()), // For BM25 matching
		filesChanged: v.array(v.string()),
		createdAt: v.number(),
	})
		.index("by_repo", ["repoId"])
		.index("by_repo_date", ["repoId", "committedAt"])
		.index("by_repo_panic", ["repoId", "panicScore"])
		.index("by_repo_hash", ["repoId", "commitHash"]),

	// ===========================================
	// TRI-LAYER BRAIN: MEMORY-FILE LINKS
	// ===========================================

	// Memory File Links - Associates memories with code files
	memory_file_links: defineTable({
		memoryId: v.id("memories"),
		codeFileId: v.id("code_files"),
		linkType: literals("applies_to", "mentions", "warns_about"),
		createdAt: v.number(),
	})
		.index("by_memory", ["memoryId"])
		.index("by_file", ["codeFileId"]),
});
